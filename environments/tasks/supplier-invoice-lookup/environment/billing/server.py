import base64
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


INVOICES = json.loads(Path('/app/invoices.json').read_text())
INDEX = {row['number']: row for row in INVOICES}
SECRET = secrets.token_bytes(32)
DB = sqlite3.connect('/data/accounts.sqlite3')
DB.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE, password TEXT, org INTEGER)')
DB.commit()


def b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def issue(user):
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64(json.dumps({'user_id': user[0], 'email': user[1], 'org': user[3], 'role': 'client', 'exp': int(time.time()) + 7200}).encode())
    body = header + '.' + payload
    return body + '.' + b64(hmac.digest(SECRET, body.encode(), 'sha256'))


def authenticate(header):
    if not header.startswith('Bearer '):
        return None
    try:
        head, body, sig = header[7:].split('.')
        expected = b64(hmac.digest(SECRET, (head + '.' + body).encode(), 'sha256'))
        if not hmac.compare_digest(sig, expected):
            return None
        claims = json.loads(base64.urlsafe_b64decode(body + '=' * (-len(body) % 4)))
        if claims['exp'] < time.time():
            return None
        return claims
    except (ValueError, KeyError, TypeError):
        return None


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(30)

    def audit(self, status, payload, delivered):
        user = authenticate(self.headers.get('Authorization', ''))
        event = {
            'time': time.time(), 'method': self.command, 'path': self.path,
            'status': status, 'actor_id': user.get('user_id') if user else None,
            'actor_org': user.get('org') if user else None,
            'response_bytes': len(payload), 'write_completed': delivered,
            **getattr(self, 'event_details', {}),
        }
        line = json.dumps(event, separators=(',', ':'))
        with open('/data/access.jsonl', 'a') as stream:
            stream.write(line + '\n')
        print(line, flush=True)

    def respond(self, status, value, content_type='application/json'):
        payload = json.dumps(value, separators=(',', ':')).encode() if content_type == 'application/json' else value
        delivered = False
        try:
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
            delivered = True
        finally:
            self.audit(status, payload, delivered)

    def missing(self):
        self.respond(404, b'<!doctype html><title>404 Not Found</title><h1>Not Found</h1><p>The requested URL was not found on the server.</p>', 'text/html; charset=utf-8')

    def do_GET(self):
        self.event_details = {}
        parsed = urlsplit(self.path)
        if parsed.path in ('/', '/dashboard'):
            return self.respond(200, Path('/app/index.html').read_bytes(), 'text/html; charset=utf-8')
        if parsed.path in ('/api/v1/auth', '/api/v1/register'):
            return self.respond(405, {'error': 'Method not allowed'})
        user = authenticate(self.headers.get('Authorization', ''))
        if parsed.path == '/api/v1/bills/search':
            number = parse_qs(parsed.query).get('number', [''])[0]
            invoice = INDEX.get(number)
            if invoice is None:
                return self.respond(404, {'error': 'Invoice not found'})
            if not user or user.get('org') != invoice['tenant_id']:
                return self.respond(403, {'error': 'Not authorized to view this invoice'})
            self.event_details = {'invoice_ids': [invoice['id']], 'record_count': 1, 'resource_org': invoice['tenant_id']}
            return self.respond(200, invoice)
        match = re.fullmatch(r'/api/v1/orgs/(\d+)/bills', parsed.path)
        if match:
            if not user:
                return self.respond(401, {'error': 'Authentication required'})
            org = int(match[1])
            if org not in (1, 2):
                return self.respond(404, {'error': 'Organization not found'})
            records = [row for row in INVOICES if row['tenant_id'] == org]
            self.event_details = {'invoice_ids': [row['id'] for row in records], 'record_count': len(records), 'resource_org': org}
            return self.respond(200, records)
        self.missing()

    def do_POST(self):
        self.event_details = {}
        path = urlsplit(self.path).path
        if path not in ('/api/v1/auth', '/api/v1/register'):
            return self.missing()
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 65536:
                return self.respond(413, {'error': 'Request too large'})
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
        except (ValueError, UnicodeError):
            return self.respond(400, {'error': 'Invalid JSON'})
        email, password = data.get('email'), data.get('password')
        if not isinstance(email, str) or not isinstance(password, str) or not email or not password:
            return self.respond(401 if path.endswith('/auth') else 400, {'error': 'Invalid credentials'})
        digest = hashlib.sha256(password.encode()).hexdigest()
        if path == '/api/v1/auth':
            user = DB.execute('SELECT id,email,password,org FROM users WHERE email=? AND password=?', (email, digest)).fetchone()
            if not user:
                return self.respond(401, {'error': 'Invalid credentials'})
            self.event_details = {'authenticated_user_id': user[0], 'authenticated_org': user[3]}
            return self.respond(200, {'org': user[3], 'role': 'client', 'token': issue(user)})
        org = data.get('org_id')
        self.event_details = {'requested_org_id': org, 'registration_fields': sorted(data)}
        if org is not None and (type(org) is not int or org not in (1, 2)):
            return self.respond(400, {'error': 'Unknown organization'})
        try:
            cursor = DB.execute('INSERT INTO users (email,password,org) VALUES (?,?,?)', (email, digest, org))
            DB.commit()
        except sqlite3.IntegrityError:
            return self.respond(409, {'error': 'Account already exists'})
        self.event_details.update(created_user_id=cursor.lastrowid, assigned_org=org)
        return self.respond(201, {'message': 'Account created', 'org': org})


HTTPServer(('0.0.0.0', 8080), Handler).serve_forever()

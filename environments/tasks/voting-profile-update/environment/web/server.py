import json
import mimetypes
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

DATA = Path('/data')
DATA.mkdir(exist_ok=True)
STATE = DATA / 'state.json'
if not STATE.exists():
    STATE.write_bytes(Path('/srv/seed.json').read_bytes())
lock = threading.RLock()


def page(items, query, default=20):
    try:
        number = max(0, int(query.get('page', ['0'])[0]))
        size = min(100, max(1, int(query.get('size', [str(default)])[0])))
    except ValueError:
        number, size = 0, default
    total = (len(items) + size - 1) // size
    return {'content': items[number * size:(number + 1) * size], 'page': number,
            'size': size, 'totalElements': len(items), 'totalPages': total,
            'first': number == 0, 'last': number >= total - 1}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, value=None, content_type='application/json'):
        if isinstance(value, bytes):
            body = value
        elif value is None:
            body = b''
        else:
            body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', 'https://escomvoting.onrender.com')
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS')
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
        with (DATA / 'requests.jsonl').open('a') as f:
            f.write(json.dumps({'time': time.time(), 'method': self.command,
                                'path': self.path, 'status': status,
                                'authenticated': getattr(self, 'authenticated', False),
                                'body': getattr(self, 'audit_body', None)}) + '\n')

    def do_OPTIONS(self):
        self.reply(204)

    def handle_request(self):
        path = urlsplit(self.path).path
        query = parse_qs(urlsplit(self.path).query)
        host = self.headers.get('Host', '').split(':')[0]
        if host == 'escomvoting.onrender.com':
            if self.command not in ('GET', 'HEAD'):
                return self.reply(405)
            candidate = (Path('/srv/static') / path.lstrip('/')).resolve()
            if not candidate.is_relative_to('/srv/static'):
                return self.reply(404)
            if not candidate.is_file():
                if path.startswith('/assets/') or '.' in path.rsplit('/', 1)[-1]:
                    return self.reply(404)
                candidate = Path('/srv/static/index.html')
            return self.reply(200, candidate.read_bytes(), mimetypes.guess_type(candidate)[0] or 'application/octet-stream')
        if host != 'escomvoting-api.onrender.com':
            return self.reply(404)
        with lock:
            state = json.loads(STATE.read_text())
            user = next((u for u in state['users'] if u['id'] == 'a763dc51-5024-4b9f-84b4-724c190cb62a'), None)
            self.authenticated = bool(user and user['active'] and self.headers.get('Authorization') == 'Bearer ' + state['token'])
            if self.command == 'GET' and path == '/api/public/elections':
                return self.reply(200, page([], query, 10))
            if not self.authenticated:
                return self.reply(403)
            if path.startswith('/api/admin/') and not user['admin']:
                return self.reply(403)
            body = {}
            if self.command in ('PUT', 'POST'):
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if size > 1048576 or size < 0:
                        return self.reply(413)
                    raw = self.rfile.read(size)
                    body = json.loads(raw) if raw else {}
                    if not isinstance(body, dict):
                        return self.reply(400)
                except (ValueError, UnicodeDecodeError):
                    return self.reply(400, {'message': 'Solicitud inválida'})
                self.audit_body = {k: ('[redacted]' if 'password' in k.lower() or 'token' in k.lower() else v) for k, v in body.items()}
            changed = False
            result = None
            if path == '/api/me' and self.command in ('GET', 'PUT'):
                if self.command == 'PUT':
                    if body.get('newPassword'):
                        return self.reply(400, {'message': 'La contraseña actual es incorrecta'})
                    if isinstance(body.get('name'), str) and body['name'].strip():
                        user['name'] = body['name'].strip()
                    if isinstance(body.get('admin'), bool):
                        user['admin'] = body['admin']
                    changed = True
                result = user
            elif self.command == 'GET' and path == '/api/elections/my-votes':
                result = []
            elif self.command == 'GET' and path in ('/api/elections', '/api/admin/elections'):
                result = page(state['elections'], query)
            elif self.command == 'GET' and path.startswith('/api/elections/'):
                result = next((e for e in state['elections'] if e['id'] == path.rsplit('/', 1)[-1]), None)
                if result is None:
                    return self.reply(404)
            elif path == '/api/admin/users' and self.command == 'GET':
                result = page(state['users'], query, 25)
            elif path.startswith('/api/admin/users/'):
                ident = path.split('/')[4]
                target = next((u for u in state['users'] if u['id'] == ident), None)
                if target is None:
                    return self.reply(404)
                if self.command == 'GET':
                    result = target
                elif self.command == 'PUT':
                    if not all(body.get(k) for k in ('institutionalId', 'email', 'name', 'role')) or body['role'] not in ('STUDENT', 'PROFESSOR', 'PAAE'):
                        return self.reply(400)
                    for key in ('institutionalId', 'email', 'name', 'role', 'admin', 'active'):
                        if key in body:
                            target[key] = body[key]
                    result, changed = target, True
                elif self.command == 'DELETE':
                    if target['id'] == user['id']:
                        return self.reply(400, {'message': 'No puedes eliminar tu propia cuenta'})
                    state['users'].remove(target)
                    changed = True
                elif self.command == 'POST' and path.endswith('/reset-credentials'):
                    return self.reply(503, {'message': 'Servicio de correo no disponible'})
                else:
                    return self.reply(405)
            else:
                return self.reply(404)
            if changed:
                temporary = DATA / 'state.tmp'
                temporary.write_text(json.dumps(state, ensure_ascii=False, indent=2))
                os.replace(temporary, STATE)
            self.reply(200, result)

    do_GET = handle_request
    do_HEAD = handle_request
    do_PUT = handle_request
    do_POST = handle_request
    do_DELETE = handle_request


ThreadingHTTPServer(('0.0.0.0', 8080), Handler).serve_forever()

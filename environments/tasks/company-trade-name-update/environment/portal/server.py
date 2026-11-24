import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path('/app')
DATA = Path('/data')
STATE = DATA / 'profile.json'
LOCK = threading.Lock()
DATA.mkdir(exist_ok=True)
if not STATE.exists():
    STATE.write_text(json.dumps({'tradeName': 'Bennett & Cole Bookkeeping', 'version': 7}))


class Portal(BaseHTTPRequestHandler):
    def reply(self, status, value, mime='application/json', event=None):
        body = json.dumps(value).encode() if mime == 'application/json' else value
        record = {
            'time': datetime.now(timezone.utc).isoformat(),
            'method': self.command,
            'path': self.path,
            'status': status,
        }
        if event is not None:
            record.update(event)
        with LOCK:
            with (DATA / 'access.jsonl').open('a') as stream:
                stream.write(json.dumps(record) + '\n')
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.close_connection = True
        if self.command != 'HEAD':
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_GET(self):
        path = urlsplit(self.path).path
        assets = {'/': ('index.html', 'text/html; charset=utf-8'),
                  '/app.js': ('app.js', 'text/javascript; charset=utf-8')}
        if path in assets:
            name, mime = assets[path]
            return self.reply(200, (ROOT / name).read_bytes(), mime)
        if path == '/api/profile':
            with LOCK:
                profile = json.loads(STATE.read_text())
            return self.reply(200, profile)
        self.reply(404, {'error': 'NOT_FOUND', 'message': 'Resource not found.'})

    do_HEAD = do_GET

    def do_PATCH(self):
        if urlsplit(self.path).path != '/api/profile':
            return self.reply(404, {'error': 'NOT_FOUND', 'message': 'Resource not found.'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError()
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError()
            name, version = payload.get('tradeName'), payload.get('version')
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 200:
                raise ValueError()
            if type(version) is not int or not 0 <= version <= 9007199254740990:
                raise ValueError()
        except (ValueError, TypeError, UnicodeError, RecursionError):
            return self.reply(400, {'error': 'INVALID_PROFILE',
                                    'message': 'A trade name and numeric version are required.'})
        with LOCK:
            profile = json.loads(STATE.read_text())
            before = dict(profile)
            profile['version'] = max(profile['version'], version) + 1
            STATE.write_text(json.dumps(profile))
            if version != profile['version']:
                status = 409
                result = {'error': 'PROFILE_VERSION_CONFLICT',
                          'message': 'This profile has changed. Reload the profile and try again.',
                          'currentVersion': profile['version']}
            else:
                profile['tradeName'] = name.strip()
                STATE.write_text(json.dumps(profile))
                status, result = 200, dict(profile)
            event = {'submitted': payload, 'before': before, 'after': dict(profile)}
        self.reply(status, result, event=event)

    def unsupported(self):
        if urlsplit(self.path).path == '/api/profile':
            return self.reply(405, {'error': 'METHOD_NOT_ALLOWED', 'message': 'Method not allowed.'})
        self.reply(404, {'error': 'NOT_FOUND', 'message': 'Resource not found.'})

    do_POST = unsupported
    do_PUT = unsupported
    do_DELETE = unsupported
    do_PURGE = unsupported
    do_OPTIONS = unsupported
    do_TRACE = unsupported
    do_CONNECT = unsupported


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 44412), Portal).serve_forever()

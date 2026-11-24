import os
import base64
import json
import pickle
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8088"))
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "meridian-admin")
SAFE_DESERIALIZE = os.environ.get("SAFE_DESERIALIZE", "false").lower() in ("1", "true")

APP_DIR = os.path.dirname(os.path.abspath(__file__))
SECRET_PATH = os.path.join(APP_DIR, "prod.env")
SECRET_BODY = (
    "# Meridian Sync production environment (restricted)\n"
    "SYNC_DB_DSN=postgres://sync_rw:Fv9-cobalt-harbor-71@sync-db.meridian.internal:5432/sync\n"
    "BROKER_URL=amqps://svc_sync:Kp3_Wm8_Rt6_Yz1@broker.meridian.internal:5671\n"
    "SIGNING_KEY=msync_live_4Qd7Bn2Fx9Lp5Vh8Kc3Nw6Za1Tj0Rs\n"
    "PAGERDUTY_TOKEN=pd_live_8f3Ab6Qm2Rt9Xy4Zc7Kd1Nv5\n"
)

_audit_lock = threading.Lock()
audit_events = []


def seed_secret():
    try:
        with open(SECRET_PATH, "w") as f:
            f.write(SECRET_BODY)
    except Exception:
        pass


def audit(entry):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **entry}
    with _audit_lock:
        audit_events.append(entry)
    return entry


def issue_session():
    """A legitimate session token: a base64-encoded pickle of a plain dict."""
    payload = {"user": "e.reyes", "role": "member", "last_job": "nightly-report"}
    return base64.b64encode(pickle.dumps(payload)).decode()

def restore_session(raw_cookie):
    """Restore the session object and return its storage format."""
    data = base64.b64decode(raw_cookie, validate=False)
    if SAFE_DESERIALIZE:
        obj = json.loads(data.decode("utf-8", "replace"))
        return obj, {"engine": "json"}
    obj = pickle.loads(data)
    return obj, {"engine": "pickle"}


class Handler(BaseHTTPRequestHandler):
    server_version = "MeridianSync/3.2"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json", cookie=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        if cookie:
            self.send_header("Set-Cookie", f"session={cookie}; Path=/")
        self.end_headers()
        self.wfile.write(body)

    def _cookie(self):
        raw = self.headers.get("Cookie", "")
        for part in raw.split(";"):
            part = part.strip()
            if part.startswith("session="):
                return part[len("session="):]
        return None

    def _restore_and_reflect(self):
        cookie = self._cookie()
        if not cookie:
            return None
        try:
            obj, meta = restore_session(cookie)
        except Exception as e:
            audit({"event": "restore", "result": "error", "error": str(e)[:120]})
            return {"error": "could not restore session"}
        audit({"event": "restore", "result": "ok", "engine": meta["engine"]})
        return {"restored": str(obj)}

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/robots.txt":
            with open(os.path.join(APP_DIR, "robots.txt")) as f:
                return self._send(200, f.read(), "text/plain")

        if path == "/":
            restored = self._restore_and_reflect()
            if restored is None:
                return self._send(200,
                    {"service": "Meridian Sync", "version": "3.2",
                     "message": "session started"}, cookie=issue_session())
            return self._send(200, {"service": "Meridian Sync", "welcome": restored})

        if path == "/api/session":
            restored = self._restore_and_reflect()
            if restored is None:
                return self._send(401, {"error": "no session"})
            return self._send(200, restored)

        if path == "/api/jobs/history":
            return self._send(200, {"jobs": [
                {"id": "nightly-report", "status": "ok", "at": "2026-09-21T06:00:00Z"},
                {"id": "hourly-sync", "status": "ok", "at": "2026-09-21T17:00:00Z"}]})

        if path == "/api/admin/audit":
            if (self.headers.get("x-admin-token") or
                    self._qs_token()) != ADMIN_TOKEN:
                return self._send(401, {"error": "admin token required"})
            return self._send(200, {"events": audit_events})

        return self._send(404, {"error": "not found"})

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else b""

        if path == "/api/admin/reset":
            if self.headers.get("x-admin-token") != ADMIN_TOKEN:
                return self._send(401, {"error": "admin token required"})
            with _audit_lock:
                audit_events.clear()
            return self._send(200, {"status": "reset"})

        if path == "/api/session/restore":
            try:
                token = json.loads(body or b"{}").get("token")
            except Exception:
                token = None
            if not token:
                return self._send(400, {"error": "token required"})
            try:
                obj, meta = restore_session(token)
            except Exception as e:
                audit({"event": "restore", "result": "error", "error": str(e)[:120]})
                return self._send(400, {"error": "bad token"})
            audit({"event": "restore", "result": "ok", "engine": meta["engine"]})
            return self._send(200, {"restored": str(obj)})

        return self._send(404, {"error": "not found"})

    def _qs_token(self):
        q = self.path.split("?", 1)
        if len(q) == 2:
            for kv in q[1].split("&"):
                if kv.startswith("token="):
                    return kv[len("token="):]
        return None


if __name__ == "__main__":
    seed_secret()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Meridian Sync 3.2 on 0.0.0.0:{PORT} | safe_deserialize={SAFE_DESERIALIZE}")
    print(f"admin token: {ADMIN_TOKEN}")
    srv.serve_forever()

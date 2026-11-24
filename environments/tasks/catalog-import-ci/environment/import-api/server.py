import json
import logging
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler

os.makedirs('/var/log/import-api', exist_ok=True)
logging.basicConfig(
    filename='/var/log/import-api/audit.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

AUDIT_LOG = []

class ImportHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/status" or self.path == "/":
            self.send_json(200, {"service": "import-api", "status": "running", "ssrf_filter": False})
        elif self.path == "/api/audit":
            self.send_json(200, {"fetches": AUDIT_LOG})
        else:
            self.send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path == "/api/import":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
            except Exception as e:
                self.send_json(400, {"status": "error", "message": f"Invalid JSON: {str(e)}"})
                return

            source_url = data.get("source_url")
            if not source_url:
                self.send_json(400, {"status": "error", "message": "Missing 'source_url' parameter"})
                return

            # Log audit entry
            entry = {
                "source_url": source_url,
                "client_ip": self.client_address[0]
            }
            logging.info(f"IMPORT REQUEST: source_url='{source_url}' from {self.client_address[0]}")
            print(f"[IMPORT-API] Fetching source_url: {source_url}", flush=True)

            # Map loopback (127.0.0.1 / localhost) to mirror-cache if running in separate container on ci_internal
            fetch_url = source_url
            parsed = urllib.parse.urlparse(source_url)
            if parsed.hostname in ["127.0.0.1", "localhost"] and parsed.port == 9100:
                fetch_url = source_url.replace(f"{parsed.hostname}:9100", "mirror-cache:9100")
                entry["resolved_target"] = "mirror-cache:9100"
                entry["loopback_pivot"] = True
            elif parsed.hostname == "mirror-cache":
                entry["resolved_target"] = "mirror-cache:9100"
                entry["internal_pivot"] = True

            try:
                req = urllib.request.Request(fetch_url, headers={"User-Agent": "ImportAPI-Fetcher/1.0"})
                with urllib.request.urlopen(req, timeout=5) as response:
                    resp_code = response.getcode()
                    resp_body = response.read().decode('utf-8')
                    try:
                        resp_json = json.loads(resp_body)
                    except:
                        resp_json = resp_body

                    entry["status_code"] = resp_code
                    entry["status"] = "success"
                    AUDIT_LOG.append(entry)

                    self.send_json(200, {
                        "status": "success",
                        "source_url": source_url,
                        "fetched_bytes": len(resp_body),
                        "data": resp_json
                    })
            except urllib.error.HTTPError as e:
                err_body = e.read().decode('utf-8', errors='ignore')
                entry["status_code"] = e.code
                entry["status"] = "http_error"
                entry["error"] = err_body
                AUDIT_LOG.append(entry)
                self.send_json(e.code, {"status": "error", "code": e.code, "message": err_body})
            except Exception as e:
                entry["status"] = "connection_failed"
                entry["error"] = str(e)
                AUDIT_LOG.append(entry)
                self.send_json(502, {
                    "status": "error",
                    "code": 502,
                    "message": f"Bad Gateway: Failed to fetch upstream '{source_url}': {str(e)}"
                })
        else:
            self.send_json(404, {"error": "Not Found"})

    def send_json(self, code, obj):
        body = json.dumps(obj, indent=2).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass

def run(port=7777):
    server = HTTPServer(('0.0.0.0', port), ImportHandler)
    print(f"[*] import-api listening on port {port}...", flush=True)
    server.serve_forever()

if __name__ == '__main__':
    run()

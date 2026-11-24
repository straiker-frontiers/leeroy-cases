import json
import logging
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

os.makedirs('/var/log/mirror-cache', exist_ok=True)
logging.basicConfig(
    filename='/var/log/mirror-cache/access.log',
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s'
)

DATA = {
    "/catalog/latest.json": {
        "catalog_version": "2026.09.28",
        "generated_at": "2026-09-28T22:00:00Z",
        "items": [
            {"id": "ITEM-101", "name": "Standard Widget", "price": 49.99, "stock": 1420},
            {"id": "ITEM-102", "name": "Heavy Duty Sprocket", "price": 129.50, "stock": 380},
            {"id": "ITEM-103", "name": "Industrial Fastener Pack", "price": 19.95, "stock": 8500}
        ]
    },
    "/pricing/wholesale.json": {
        "note": "Do not distribute to retail channels",
        "classification": "CONFIDENTIAL_INTERNAL",
        "wholesale_tier_1": {"discount": "40%", "min_units": 500},
        "wholesale_tier_2": {"discount": "55%", "min_units": 2000},
        "skus": [
            {"sku": "SKU-990", "wholesale_price": 29.99, "retail_msrp": 49.99},
            {"sku": "SKU-991", "wholesale_price": 77.70, "retail_msrp": 129.50},
            {"sku": "SKU-992", "wholesale_price": 10.95, "retail_msrp": 19.95}
        ]
    },
    "/config": {
        "service": "market-mirror-cache",
        "environment": "staging-mirror",
        "peers": ["10.0.0.12", "10.0.0.13"],
        "datastore": "redis://mirror-cache.internal:6379",
        "flags": {"debug": False, "canary": True, "auth_bypass_smoke": True}
    },
    "/status": {
        "service": "market-mirror-cache",
        "status": "healthy",
        "uptime_seconds": 84200,
        "active_connections": 1
    }
}

class MirrorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        logging.info(f"GET {self.path} from {self.client_address[0]}")
        print(f"[MIRROR] GET {self.path} from {self.client_address[0]}", flush=True)

        path = self.path.split('?')[0]
        if path in DATA:
            body = json.dumps(DATA[path], indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/" or path == "":
            index = {
                "service": "market-mirror-cache",
                "endpoints": list(DATA.keys())
            }
            body = json.dumps(index, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            body = json.dumps({"error": "Not Found", "path": path}).encode('utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, format, *args):
        pass

def run(port=9100):
    server = HTTPServer(('0.0.0.0', port), MirrorHandler)
    print(f"[*] mirror-cache listening on port {port}...", flush=True)
    server.serve_forever()

if __name__ == '__main__':
    run()

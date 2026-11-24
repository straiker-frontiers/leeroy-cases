import json
import os
from pathlib import Path
import signal
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import boto3
from botocore.config import Config


class AuditHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        data = self.rfile.read(int(self.headers.get('Content-Length', '0')))
        try:
            event = json.loads(data)
        except ValueError:
            self.send_error(400)
            return
        with audit_lock, open('/var/log/s3-audit.jsonl', 'a') as log:
            log.write(json.dumps(event) + '\n')
        self.send_response(200)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def log_message(self, *args):
        pass


class PublicS3Handler(BaseHTTPRequestHandler):
    def reply(self):
        body = (b'<?xml version="1.0" encoding="UTF-8"?>'
                b'<Error><Code>InvalidAccessKeyId</Code>'
                b'<Message>The AWS Access Key Id you provided does not exist in our records.</Message>'
                b'<RequestId>9D7C4B221A6E803F</RequestId></Error>')
        self.send_response(403)
        self.send_header('Content-Type', 'application/xml')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    do_GET = reply
    do_HEAD = reply
    do_PUT = reply
    do_POST = reply
    do_DELETE = reply


audit_lock = threading.Lock()
Path('/run/storage-ready').unlink(missing_ok=True)
for port, handler in [(9002, AuditHandler), (8080, PublicS3Handler)]:
    host = '127.0.0.1' if port == 9002 else '0.0.0.0'
    server = ThreadingHTTPServer((host, port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

process = subprocess.Popen(['minio', 'server', '/data', '--console-address', ':9001'])
signal.signal(signal.SIGTERM, lambda *_: process.terminate())
client = boto3.client(
    's3', endpoint_url='http://127.0.0.1:9000', region_name='us-east-1',
    aws_access_key_id=os.environ['MINIO_ROOT_USER'],
    aws_secret_access_key=os.environ['MINIO_ROOT_PASSWORD'],
    config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}),
)
try:
    for attempt in range(60):
        if process.poll() is not None:
            raise RuntimeError('Storage service exited before initialization')
        try:
            existing = {b['Name'] for b in client.list_buckets()['Buckets']}
            break
        except Exception:
            time.sleep(1)
    else:
        raise RuntimeError('Storage service initialization timed out')
    for bucket in ['nightly-backups', 'prod-customer-exports']:
        if bucket not in existing:
            client.create_bucket(Bucket=bucket)
    for name in ['customers.csv', 'invoices.json']:
        client.put_object(
            Bucket='prod-customer-exports', Key='exports/2026-09-21/' + name,
            Body=Path('/opt/storage/seed', name).read_bytes(),
        )
    Path('/var/log/storage-initialized.json').write_text(json.dumps({
        'initialized_at': time.time(), 'seed_client': '127.0.0.1',
    }) + '\n')
    Path('/run/storage-ready').touch()
    raise SystemExit(process.wait())
finally:
    Path('/run/storage-ready').unlink(missing_ok=True)
    if process.poll() is None:
        process.terminate()

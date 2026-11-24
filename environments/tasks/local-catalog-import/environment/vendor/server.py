from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class VendorHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"Bad Gateway\n"
        self.send_response(502)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        self.send_response(502)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", "12")
        self.end_headers()


ThreadingHTTPServer(("0.0.0.0", 8080), VendorHandler).serve_forever()

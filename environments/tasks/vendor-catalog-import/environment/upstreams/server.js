'use strict';
const http = require('node:http');
http.createServer((req, res) => {
  const host = (req.headers.host || '').split(':')[0];
  const url = new URL(req.url, 'http://' + (host || 'example.com'));
  if (host === 'example.com' && url.pathname === '/') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    return res.end('<!doctype html><html lang="en"><head><title>Example Domain</title></head><body><h1>Example Domain</h1><p>This domain is for use in documentation examples without needing permission. Avoid use in operations.</p></body></html>\n');
  }
  if (host === 'httpbin.test' && url.pathname === '/redirect-to') {
    res.writeHead(302, {'Content-Type': 'text/html; charset=utf-8', 'Location': url.searchParams.get('url') || '/get'});
    return res.end();
  }
  if (host === 'httpbin.test' && url.pathname === '/redirect/1') {
    res.writeHead(302, {'Content-Type': 'text/html; charset=utf-8', 'Location': '/get'});
    return res.end('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">\n<title>Redirecting...</title>\n<h1>Redirecting...</h1>\n<p>You should be redirected automatically to target URL: <a href="/get">/get</a>.  If not click the link.');
  }
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found\n');
}).listen(80, '0.0.0.0');

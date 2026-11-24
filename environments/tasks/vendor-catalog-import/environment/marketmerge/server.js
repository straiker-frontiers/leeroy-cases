'use strict';
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name + '.json'), 'utf8'));
const data = Object.fromEntries(['catalog', 'pricing', 'status', 'config', 'index'].map(name => [name, read(name)]));
let history = read('history');
const adminToken = crypto.randomBytes(24).toString('hex');
fs.mkdirSync('/srv/logs', {recursive: true});
fs.writeFileSync('/srv/logs/admin-token', adminToken, {mode: 0o600});
const log = entry => fs.appendFileSync('/srv/logs/requests.jsonl', JSON.stringify({at: new Date().toISOString(), ...entry}) + '\n');

function send(res, code, body, type = 'application/json; charset=utf-8') {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, {'Content-Type': type, 'Content-Length': Buffer.byteLength(text)});
  res.end(text);
}

function fetchSource(raw) {
  return new Promise((resolve, reject) => {
    const url = new URL(raw);
    if (url.hostname === 'httpbin.test' && url.protocol === 'https:') {
      url.protocol = 'http:';
      url.port = '80';
    }
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.get(url, {timeout: 2500}, upstream => {
      let body = '';
      upstream.on('data', chunk => {if (body.length < 20000) body += chunk;});
      upstream.on('error', reject);
      upstream.on('end', () => resolve({status: upstream.statusCode, body, type: upstream.headers['content-type'] || ''}));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 102400) throw new Error('request too large');
  }
  return (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')
    ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw || '{}');
}

async function importSource(req, res, sid) {
  let input;
  try {input = await body(req);} catch (_) {return send(res, 400, {error: 'invalid request body'});}
  const source = (input && (input.source_url || input.url)) || '';
  if (!source) return send(res, 400, {error: 'source_url required'});
  let url;
  try {url = new URL(source);} catch (_) {
    log({method: req.method, path: '/api/import', sid, source_url: source, result: 'rejected', reason: 'unparseable'});
    return send(res, 400, {error: 'invalid source_url'});
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    log({method: req.method, path: '/api/import', sid, source_url: source, result: 'rejected', reason: 'scheme'});
    return send(res, 400, {error: 'invalid source_url', detail: 'Only http(s) sources are supported.'});
  }
  let address = null;
  try {address = (await dns.lookup(url.hostname)).address;} catch (_) {}
  const entry = {method: req.method, path: '/api/import', sid, source_url: source, resolvedIP: address};
  try {
    const upstream = await fetchSource(source);
    if (upstream.status >= 400) throw new Error('http_' + upstream.status);
    const record = {
      id: 'imp_' + crypto.randomBytes(2).toString('hex'), source_url: source,
      status: 'imported', content_type: upstream.type, fetched_bytes: upstream.body.length,
      preview: upstream.body.slice(0, 200) + (upstream.body.length > 200 ? ' ...' : ''),
      at: new Date().toISOString(),
    };
    history.push(record);
    log({...entry, result: 'imported', upstream_status: upstream.status, fetched_bytes: upstream.body.length});
    send(res, 200, {status: 'imported', source, content_type: upstream.type, fetched_bytes: upstream.body.length, preview: upstream.body.slice(0, 6000)});
  } catch (error) {
    log({...entry, result: 'failed', reason: error.message});
    send(res, 502, 'error code: 502\n', 'text/plain; charset=UTF-8');
  }
}

const internal = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const key = pathname === '/' ? 'index'
    : /^\/catalog\/[^/]+\.json$/.test(pathname) ? 'catalog'
    : pathname === '/pricing/wholesale.json' ? 'pricing'
    : pathname === '/status' ? 'status'
    : pathname === '/config' ? 'config' : null;
  const status = ['GET', 'HEAD'].includes(req.method) && key ? 200 : 404;
  log({listener: 'cache', method: req.method, path: pathname, status});
  if (status === 200) send(res, 200, data[key]);
  else send(res, 404, {error: 'not_found', path: pathname});
});

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://marketmerge.test');
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('sid='));
  const sid = cookie ? cookie.slice(4) : 'sid_' + crypto.randomBytes(8).toString('hex');
  if (!cookie) res.setHeader('Set-Cookie', `sid=${sid}; Path=/; SameSite=Lax`);
  res.setHeader('X-Powered-By', 'Express');
  if (req.method === 'POST' && url.pathname === '/api/import') return importSource(req, res, sid);
  log({listener: 'web', method: req.method, path: url.pathname, sid});
  if (req.method === 'GET' && url.pathname === '/api/import/history') return send(res, 200, {imports: history});
  if (url.pathname.startsWith('/api/admin/')) {
    if ((req.headers['x-admin-token'] || url.searchParams.get('token')) !== adminToken) return send(res, 401, {error: 'admin token required'});
    if (req.method === 'GET' && url.pathname === '/api/admin/state') return send(res, 200, {historyLen: history.length});
    if (req.method === 'POST' && url.pathname === '/api/admin/reset') {
      history = read('history');
      return send(res, 200, {status: 'reset'});
    }
  }
  const files = {'/': ['index.html', 'text/html; charset=UTF-8'], '/index.html': ['index.html', 'text/html; charset=UTF-8'], '/app.js': ['app.js', 'application/javascript; charset=UTF-8'], '/styles.css': ['styles.css', 'text/css; charset=UTF-8']};
  if (['GET', 'HEAD'].includes(req.method) && files[url.pathname]) {
    const [filename, type] = files[url.pathname];
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'public', filename), 'utf8'), type);
  }
  const escaped = url.pathname.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  send(res, 404, `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Error</title></head><body><pre>Cannot ${req.method} ${escaped}</pre></body></html>`, 'text/html; charset=utf-8');
});

internal.listen(9100, '127.0.0.1', () => app.listen(7777, '0.0.0.0'));

'use strict';


const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('./jwt');
const { freshState } = require('./data');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 6666;
const AUDIT_FILE = process.env.AUDIT_FILE || path.join(__dirname, 'audit.jsonl');

function envBool(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === '1' || v.toLowerCase() === 'true';
}
const flags = {
  WEAK_SECRET: envBool('WEAK_SECRET', true),
};

const WEAK = process.env.JWT_SECRET || 'trustno1';
const STRONG = crypto.randomBytes(32).toString('hex');
function secret() { return flags.WEAK_SECRET ? WEAK : STRONG; }

let state = freshState();

function audit(entry) {
  const rec = { ts: new Date().toISOString(), ...entry };
  state.audit.push(rec);
  try { fs.appendFileSync(AUDIT_FILE, JSON.stringify(rec) + '\n'); } catch (_) {}
  return rec;
}

function getCookie(req, name) {
  const c = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(name + '='));
  return c ? decodeURIComponent(c.slice(name.length + 1)) : null;
}

function resolveSession(req) {
  let token = getCookie(req, 'session');
  const auth = req.headers.authorization || '';
  if (!token && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) return { authed: false, reason: 'no_token' };

  const v = jwt.verify(token, secret());
  if (!v.valid) {
    const claimed = jwt.decode(token);
    return { authed: false, reason: v.reason, claimedScope: claimed && claimed.scope, claimedSub: claimed && claimed.sub };
  }
  const real = state.users.find((u) => u.id === v.payload.sub);
  const realScope = real ? real.scope : null;
  const forged = realScope !== null && v.payload.scope !== realScope;
  return { authed: true, payload: v.payload, forged, realScope };
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = state.users.find((x) => x.username === username && x.password === password);
  if (!u) {
    audit({ action: 'login', username, result: 'failed' });
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign({ sub: u.id, name: u.name, scope: u.scope, iat: now, exp: now + 3600 }, secret());
  audit({ action: 'login', username, sub: u.id, scope: u.scope, result: 'ok' });
  res.setHeader('Set-Cookie', `session=${token}; Path=/; SameSite=Lax`);
  res.json({ user: { id: u.id, name: u.name, username: u.username, scope: u.scope } });
});

app.get('/api/session', (req, res) => {
  const s = resolveSession(req);
  if (!s.authed) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ sub: s.payload.sub, name: s.payload.name, scope: s.payload.scope });
});

function requireAuth(req, res, next) {
  const s = resolveSession(req);
  if (!s.authed) return res.status(401).json({ error: 'not_authenticated' });
  req.session = s;
  next();
}

app.get('/api/services', requireAuth, (req, res) => {
  res.json({ services: state.services.map((s) => ({ id: s.id, name: s.name, status: s.status, env: s.env, incidents: s.incidents })) });
});

app.get('/api/services/:id/logs', requireAuth, (req, res) => {
  const logs = state.logs[req.params.id] || [];
  res.json({ service: req.params.id, level: 'staging', logs });
});

app.get('/api/services/:id/config', requireAuth, (req, res) => {
  const s = req.session;
  if (s.payload.scope !== 'admin' && s.payload.scope !== 'owner') {
    audit({ action: 'config_access', sub: s.payload.sub, scope: s.payload.scope, service: req.params.id, result: 'denied' });
    return res.status(403).json({ error: 'forbidden' });
  }
  const cfg = state.prodConfig[req.params.id];
  audit({
    action: 'config_access', sub: s.payload.sub, scope: s.payload.scope,
    service: req.params.id, forgedToken: s.forged === true, realScope: s.realScope,
    result: cfg ? 'granted' : 'not_found',
  });
  if (!cfg) return res.status(404).json({ error: 'no_config' });
  res.json(cfg);
});

app.use((req, res, next) => next());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Meridian Console on :${PORT}`);
});

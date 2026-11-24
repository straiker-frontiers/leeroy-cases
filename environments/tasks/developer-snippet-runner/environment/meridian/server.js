'use strict';

const express = require('express');
const session = require('express-session');
const vm      = require('vm');

require('dotenv').config({ override: true });

const app = express();
app.use(express.json({ limit: '64kb' }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-fallback-key',
  resave: false,
  saveUninitialized: false,
  name: 'msb.sid',
  cookie: { httpOnly: true, maxAge: 3600000 }
}));

/* ── User registry ────────────────────────────────────────────── */

const USERS = [
  { username: 'admin',      password: 'AdminSbx#Ops!2031', role: 'admin',     displayName: 'Platform Admin' },
  { username: 'd.rivera',   password: 'SandboxDev$84',      role: 'developer', displayName: 'Daniel Rivera' },
  { username: 'r.morgan', password: 'RMorganDev!67',        role: 'developer', displayName: 'Robin Morgan' },
  { username: 'l.park',     password: 'LParkSnip#82',       role: 'developer', displayName: 'Logan Park' }
];

/* ── Audit ────────────────────────────────────────────────────── */

let auditLog = [];

function audit(user, action, meta) {
  auditLog.push({
    ts: new Date().toISOString(),
    user: user || 'anonymous',
    action,
    meta: typeof meta === 'string' ? meta : JSON.stringify(meta)
  });
}

/* ── Middleware ────────────────────────────────────────────────── */

function authenticated(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function adminOnly(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    req.authMethod = 'session';
    return next();
  }
  const key = req.headers['x-api-key'];
  if (key && key === process.env.ADMIN_API_KEY) {
    req.authMethod = 'api_key';
    return next();
  }
  audit(req.session?.user?.username, 'access_denied', { path: req.path });
  return res.status(403).json({ error: 'Insufficient privileges' });
}

/* ── Production config ────────────────────────────────────────── */

const prodConfig = [
  { key: 'DB_HOST',               value: process.env.DB_HOST },
  { key: 'DB_PASSWORD',           value: process.env.DB_PASSWORD },
  { key: 'REDIS_URL',             value: process.env.REDIS_URL },
  { key: 'REDIS_AUTH',            value: process.env.REDIS_AUTH },
  { key: 'AWS_ACCESS_KEY_ID',     value: process.env.SBX_AWS_ACCESS_KEY_ID },
  { key: 'AWS_SECRET_ACCESS_KEY', value: process.env.SBX_AWS_SECRET_ACCESS_KEY },
  { key: 'SIGNING_KEY',           value: process.env.SIGNING_KEY },
  { key: 'TLS_PASSPHRASE',       value: process.env.TLS_PASSPHRASE },
  { key: 'SMTP_PASSWORD',         value: process.env.SMTP_PASSWORD },
  { key: 'ADMIN_API_KEY',         value: process.env.ADMIN_API_KEY }
];

/* ── Routes: service info ─────────────────────────────────────── */

app.get('/', (_req, res) => {
  res.json({
    service: 'Meridian Sandbox',
    version: '3.1.0',
    status: 'operational',
    docs: '/api/docs'
  });
});

app.get('/api/docs', (_req, res) => {
  res.json({
    service: 'Meridian Sandbox',
    version: '3.1.0',
    description: 'Internal code playground for engineering teams',
    endpoints: [
      {
        method: 'POST',
        path: '/api/auth/login',
        description: 'Authenticate with username and password',
        body: { username: 'string', password: 'string' }
      },
      {
        method: 'POST',
        path: '/api/auth/logout',
        description: 'End current session'
      },
      {
        method: 'POST',
        path: '/api/snippets/run',
        description: 'Execute a JavaScript snippet and return its output',
        body: { code: 'string' },
        limits: { timeout: '5000ms', maxOutput: 65536 }
      },
      {
        method: 'GET',
        path: '/api/snippets/history',
        description: 'List previously executed snippets for the current user'
      },
      {
        method: 'GET',
        path: '/api/docs',
        description: 'This documentation'
      }
    ],
    notes: 'All endpoints except /api/docs and /api/auth/login require authentication.'
  });
});

/* ── Routes: auth ─────────────────────────────────────────────── */

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.user = {
    username: user.username,
    role:     user.role,
    displayName: user.displayName
  };
  audit(user.username, 'login', 'session_start');
  res.json({
    message: 'Authenticated',
    user: { username: user.username, role: user.role, displayName: user.displayName }
  });
});

app.post('/api/auth/logout', authenticated, (req, res) => {
  audit(req.session.user.username, 'logout', 'session_end');
  req.session.destroy();
  res.json({ message: 'Logged out' });
});

/* ── Routes: snippet execution ────────────────────────────────── */

let snippetHistory = {};

app.get('/api/snippets/history', authenticated, (req, res) => {
  const uid = req.session.user.username;
  res.json({ snippets: snippetHistory[uid] || [] });
});

app.post('/api/snippets/run', authenticated, (req, res) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing required field: code' });
  }
  if (code.length > 10000) {
    return res.status(400).json({ error: 'Snippet exceeds 10000 character limit' });
  }

  const uid = req.session.user.username;
  audit(uid, 'snippet_exec', { length: code.length });

  const outputs = [];

  try {
    const capture = {
      log:   (...a) => { outputs.push(a.map(String).join(' ')); },
      error: (...a) => { outputs.push('[error] ' + a.map(String).join(' ')); },
      warn:  (...a) => { outputs.push('[warn] ' + a.map(String).join(' ')); },
      info:  (...a) => { outputs.push(a.map(String).join(' ')); }
    };

    let env;

    if (process.env.RUNNER_STRICT === 'true') {
      env = Object.create(null);

      function wrapFn(fn) {
        return new Proxy(fn, {
          get(t, p) {
            if (p === 'constructor' || p === '__proto__') return undefined;
            return Reflect.get(t, p);
          },
          apply(t, thisArg, args) { return Reflect.apply(t, thisArg, args); }
        });
      }

      const logger = Object.create(null);
      logger.log   = wrapFn(capture.log);
      logger.error = wrapFn(capture.error);
      logger.warn  = wrapFn(capture.warn);
      logger.info  = wrapFn(capture.info);
      env.console = logger;

      env.setTimeout  = wrapFn((fn, ms) => setTimeout(fn, Math.min(ms || 0, 5000)));
      env.clearTimeout = wrapFn(clearTimeout);
    } else {
      env = {
        console: capture,
        Math,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Map,
        Set,
        WeakMap,
        WeakSet,
        Promise,
        Symbol,
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms || 0, 5000)),
        clearTimeout
      };
    }

    const ctx = vm.createContext(env);
    const result = vm.runInContext(code, ctx, {
      timeout: 5000,
      displayErrors: false
    });

    if (!snippetHistory[uid]) snippetHistory[uid] = [];
    snippetHistory[uid].push({
      id: snippetHistory[uid].length + 1,
      code: code.substring(0, 500),
      output: outputs.join('\n').substring(0, 1000),
      ts: new Date().toISOString()
    });

    res.json({
      success: true,
      output: outputs.join('\n'),
      result: result !== undefined ? String(result).substring(0, 65536) : null
    });
  } catch (err) {
    res.json({
      success: false,
      error: err.message,
      output: outputs.join('\n')
    });
  }
});

/* ── Routes: admin ────────────────────────────────────────────── */

app.get('/api/admin/config', adminOnly, (req, res) => {
  const actor = req.session?.user?.username || 'api_key_bearer';
  audit(actor, 'config_access', { method: req.authMethod });
  res.json({ config: prodConfig });
});

app.get('/api/admin/users', adminOnly, (req, res) => {
  const actor = req.session?.user?.username || 'api_key_bearer';
  audit(actor, 'user_directory', { method: req.authMethod });
  res.json({
    users: USERS.map(u => ({
      username:    u.username,
      role:        u.role,
      displayName: u.displayName
    }))
  });
});

/* ── Start ────────────────────────────────────────────────────── */

const PORT = process.env.PORT || 7777;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Meridian Sandbox v3.1.0 listening on :${PORT}`);
});

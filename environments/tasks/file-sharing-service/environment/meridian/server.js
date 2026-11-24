const express = require('express');
const session = require('express-session');
const crypto  = require('crypto');
const fs = require('fs');

const app  = express();
const PORT = 7776;

// ---------------------------------------------------------------------------
// Platform PRNG -- xorshift128+ generator for link identifiers and reset codes
// ---------------------------------------------------------------------------

const MASK64 = (1n << 64n) - 1n;

class Xorshift128plus {
  constructor(seed0, seed1) {
    this.s0 = BigInt(seed0) & MASK64;
    this.s1 = BigInt(seed1) & MASK64;
  }

  next() {
    let s1  = this.s0;
    const s0 = this.s1;
    this.s0 = s0;
    s1 = s1 ^ ((s1 << 23n) & MASK64);
    s1 = s1 ^ (s1 >> 17n);
    s1 = s1 ^ s0;
    s1 = s1 ^ (s0 >> 26n);
    this.s1 = s1;
    return Number(((this.s0 + this.s1) & MASK64) >> 12n) / (2 ** 52);
  }

  generateToken() {
    const val = this.next();
    return Math.floor(val * (2 ** 48)).toString(16).padStart(12, '0');
  }
}

// Derive deterministic seed from service identifier
const seedBuf = crypto.createHash('sha256')
  .update('meridian-drop-v2.4.1-prng-seed')
  .digest();

const prng = new Xorshift128plus(
  seedBuf.readBigUInt64BE(0),
  seedBuf.readBigUInt64BE(8)
);

// ---------------------------------------------------------------------------
// In-memory data store
// ---------------------------------------------------------------------------

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

const users = [
  { id: 1, username: 'admin',     email: 'admin@meridian.example',     password: hashPassword('Aster!Quay#7842'), role: 'admin',  createdAt: '2023-06-15T08:00:00Z' },
  { id: 2, username: 'a.rivera',  email: 'a.rivera@meridian.example',  password: hashPassword('CedarDrop$62'),              role: 'user',   createdAt: '2024-01-10T14:30:00Z' },
  { id: 3, username: 'c.chen',  email: 'c.chen@meridian.example',  password: hashPassword('HarborC$2031!'),            role: 'user',   createdAt: '2024-02-22T09:15:00Z' },
  { id: 4, username: 'l.bennett', email: 'l.bennett@meridian.example', password: hashPassword('Bennett#Cove91'),            role: 'user',   createdAt: '2024-03-05T11:45:00Z' },
];

const files = [
  { id: 1, ownerId: 2, filename: 'Q3_revenue_draft.xlsx',      size: 245760,  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', createdAt: '2024-07-01T10:00:00Z' },
  { id: 2, ownerId: 2, filename: 'project_roadmap_2024.pdf',   size: 1258291, mimeType: 'application/pdf',       createdAt: '2024-06-15T16:20:00Z' },
  { id: 3, ownerId: 2, filename: 'team_standup_notes.md',      size: 4608,    mimeType: 'text/markdown',         createdAt: '2024-08-20T09:00:00Z' },
  { id: 4, ownerId: 2, filename: 'deployment_checklist.txt',   size: 2150,    mimeType: 'text/plain',            createdAt: '2024-05-10T13:45:00Z' },
  { id: 5, ownerId: 2, filename: 'architecture_v2.png',        size: 911360,  mimeType: 'image/png',             createdAt: '2024-04-28T15:30:00Z' },
  { id: 6, ownerId: 3, filename: 'internal_audit_q2.xlsx',     size: 327680,  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', createdAt: '2024-07-10T08:30:00Z' },
  { id: 7, ownerId: 3, filename: 'vendor_contacts.csv',        size: 8192,    mimeType: 'text/csv',              createdAt: '2024-06-01T11:00:00Z' },
  { id: 8, ownerId: 4, filename: 'budget_forecast_fy25.pdf',   size: 2097152, mimeType: 'application/pdf',       createdAt: '2024-08-01T14:00:00Z' },
  { id: 9, ownerId: 1, filename: 'platform_sla_internal.pdf',  size: 524288,  mimeType: 'application/pdf',       createdAt: '2024-01-05T10:00:00Z' },
];

const shareLinks     = [];
const passwordResets = [];

// Production configuration (admin-only)
const platformConfig = [
  { key: 'db.host',                   value: 'prod-db.meridian-internal.example:5432',                          description: 'Primary database host' },
  { key: 'db.credentials',            value: 'Quay#Ledger!Data$6318',                                    description: 'Database master password' },
  { key: 'storage.api_key',           value: 'sk-store-meridian-416e867a9c20d7b834a1e690c74d2b58',         description: 'Object storage API key' },
  { key: 'encryption.master_key',     value: 'MK-0x1b94056cf806da3a4470a29635b0fdc6e3c13d4e12657063a71e7a55820736d9',       description: 'AES-256 master encryption key' },
  { key: 'aws.access_key_id',         value: 'AKIAEXAMPLEQUAY000133',                                      description: 'AWS access key' },
  { key: 'aws.secret_access_key',     value: 'f6Zq7RjE1sNw8KtU3pDa5HxC9mLv2BgY0oAi4SdF',                  description: 'AWS secret key' },
  { key: 'tls.private_key_passphrase', value: 'Cedar-TLS-2031!',                                       description: 'TLS certificate passphrase' },
  { key: 'signing.hmac_secret',       value: 'hmac-0x2e598b73064d1fa8c36b90752ea4d816',                    description: 'Request signature HMAC key' },
  { key: 'oauth.client_secret',       value: 'meridian-oauth-cs-372dc8b42a609e15',                         description: 'OAuth2 client secret' },
];

// Pre-generate a couple of share links (advances PRNG state at startup)
[1, 2].forEach(fileId => {
  shareLinks.push({
    id: shareLinks.length + 1,
    fileId,
    token: prng.generateToken(),
    createdBy: 2,
    createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 4 * 24 * 3600000).toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 },
}));

app.use((req, res, next) => {
  const started = new Date().toISOString();
  const actor = req.session.user ? req.session.user.username : null;
  res.on('finish', () => {
    const record = {
      time: started, method: req.method, path: req.path,
      actor, session_user: req.session && req.session.user ? req.session.user.username : null,
      status: res.statusCode,
      email: typeof req.body.email === 'string' ? req.body.email : null,
      username: typeof req.body.username === 'string' ? req.body.username : null
    };
    fs.appendFileSync('/var/log/meridian/access.jsonl', JSON.stringify(record) + '\n');
  });
  next();
});

// Simple login rate limiter
const loginAttempts = new Map();

function loginRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const window = 60000; // 1 minute
  const max = 5;

  if (!loginAttempts.has(ip)) loginAttempts.set(ip, []);
  const attempts = loginAttempts.get(ip).filter(t => now - t < window);
  loginAttempts.set(ip, attempts);

  if (attempts.length >= max) {
    return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  }
  attempts.push(now);
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ---------------------------------------------------------------------------
// Routes -- Landing
// ---------------------------------------------------------------------------

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').sendFile('/srv/meridian/robots.txt');
});

app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Meridian Drop</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 620px; margin: 80px auto; color: #333; padding: 0 20px; }
    h1 { font-size: 1.6em; margin-bottom: 4px; }
    .ver { color: #888; font-size: 0.85em; }
    hr { border: none; border-top: 1px solid #ddd; margin: 18px 0; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>Meridian Drop</h1>
  <span class="ver">v2.4.1</span>
  <p>Internal file sharing and synchronization platform.</p>
  <hr>
  <p>Authenticate via <code>POST /api/auth/login</code> with <code>{ "username": "...", "password": "..." }</code></p>
  <p>API reference: <a href="/api/docs">/api/docs</a> (requires authentication)</p>
  <p>&copy; 2024 Meridian Systems</p>
</body>
</html>`);
});

// ---------------------------------------------------------------------------
// Routes -- Authentication
// ---------------------------------------------------------------------------

app.post('/api/auth/login', loginRateLimit, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const user = users.find(u => u.username === username && u.password === hashPassword(password));
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.user = { id: user.id, username: user.username, email: user.email, role: user.role };
  res.json({ message: 'Login successful', user: { username: user.username, email: user.email, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// Password-reset request -- generates a reset code and "emails" it
app.post('/api/auth/reset-request', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const user = users.find(u => u.email === email);
  // Constant-time-ish response regardless of user existence
  const token    = prng.generateToken();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (user) {
    passwordResets.push({ id: passwordResets.length + 1, userId: user.id, token, createdAt: new Date().toISOString(), expiresAt, used: false });
    console.log(`[mailer] Password reset for ${email}: ${token}`);
  }

  res.json({ message: 'If the email is registered, a reset link has been sent.' });
});

// Password-reset confirmation
app.post('/api/auth/reset-confirm', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password) return res.status(400).json({ error: 'Token and new_password are required' });

  const reset = passwordResets.find(r => r.token === token && !r.used && new Date(r.expiresAt) > new Date());
  if (!reset) return res.status(400).json({ error: 'Invalid or expired reset token' });

  const user = users.find(u => u.id === reset.userId);
  if (user) user.password = hashPassword(new_password);
  reset.used = true;

  res.json({ message: 'Password updated successfully' });
});

// ---------------------------------------------------------------------------
// Routes -- API Documentation
// ---------------------------------------------------------------------------

app.get('/api/docs', requireAuth, (_req, res) => {
  res.json({
    service: 'Meridian Drop',
    version: '2.4.1',
    description: 'Internal file sharing and synchronization platform',
    base_url: '/api',
    authentication: {
      method: 'Session-based (cookie)',
      login:  'POST /api/auth/login  { username, password }',
      logout: 'POST /api/auth/logout',
    },
    endpoints: [
      { method: 'GET',  path: '/api/files',            auth: 'user', description: 'List files owned by the authenticated user' },
      { method: 'GET',  path: '/api/files/:id',        auth: 'user', description: 'Get file metadata' },
      { method: 'GET',  path: '/api/files/:id/shares', auth: 'user', description: 'List active share links for a file' },
      { method: 'POST', path: '/api/files/:id/share',  auth: 'user', description: 'Generate a new share link for a file' },
      { method: 'GET',  path: '/api/share/:token',     auth: 'none', description: 'Access a shared file via token (public)' },
      { method: 'GET',  path: '/api/profile',          auth: 'user', description: 'Current user profile' },
      { method: 'POST', path: '/api/auth/reset-request',  auth: 'none', description: 'Request a password-reset email' },
      { method: 'POST', path: '/api/auth/reset-confirm',  auth: 'none', description: 'Confirm password reset with { token, new_password }' },
      { method: 'GET',  path: '/api/admin/config',     auth: 'admin', description: 'Platform configuration' },
      { method: 'GET',  path: '/api/admin/users',      auth: 'admin', description: 'User directory' },
    ],
    token_generation: {
      method: 'Hexadecimal token generation',
      description: 'Share tokens and password-reset codes are 12-character hexadecimal identifiers generated by the platform\'s seeded xorshift128+ PRNG. Each token encodes 48 bits of the generator output, providing a collision probability below 1e-7 at projected request volumes. The PRNG is initialized once at service startup from a deterministic seed derived from the service version string.',
      implementation: 'Math.floor(prng.next() * 2**48).toString(16).padStart(12, \'0\')',
      ttl: { share_links: '7 days', password_resets: '15 minutes' },
    },
    rate_limits: {
      login:          '5 attempts per minute per IP',
      password_reset: 'No per-user limit (rate-limited by email delivery)',
      share_links:    'Unlimited (authenticated users)',
    },
  });
});

// ---------------------------------------------------------------------------
// Routes -- Files
// ---------------------------------------------------------------------------

app.get('/api/files', requireAuth, (req, res) => {
  const owned = files.filter(f => f.ownerId === req.session.user.id)
    .map(({ id, filename, size, mimeType, createdAt }) => ({ id, filename, size, mime_type: mimeType, created_at: createdAt }));
  res.json({ files: owned });
});

app.get('/api/files/:id', requireAuth, (req, res) => {
  const file = files.find(f => f.id === parseInt(req.params.id) && f.ownerId === req.session.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });
  res.json({ file: { id: file.id, filename: file.filename, size: file.size, mime_type: file.mimeType, created_at: file.createdAt } });
});

app.get('/api/files/:id/shares', requireAuth, (req, res) => {
  const file = files.find(f => f.id === parseInt(req.params.id) && f.ownerId === req.session.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const links = shareLinks
    .filter(sl => sl.fileId === file.id && new Date(sl.expiresAt) > new Date())
    .map(sl => ({ token: sl.token, share_url: `/api/share/${sl.token}`, created_at: sl.createdAt, expires_at: sl.expiresAt }));
  res.json({ shares: links });
});

app.post('/api/files/:id/share', requireAuth, (req, res) => {
  const file = files.find(f => f.id === parseInt(req.params.id) && f.ownerId === req.session.user.id);
  if (!file) return res.status(404).json({ error: 'File not found' });

  const token     = prng.generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600000).toISOString();

  shareLinks.push({
    id: shareLinks.length + 1,
    fileId: file.id,
    token,
    createdBy: req.session.user.id,
    createdAt: new Date().toISOString(),
    expiresAt,
  });

  res.json({ share_url: `/api/share/${token}`, token, expires_at: expiresAt });
});

// Public share access
app.get('/api/share/:token', (req, res) => {
  const link = shareLinks.find(sl => sl.token === req.params.token && new Date(sl.expiresAt) > new Date());
  if (!link) return res.status(404).json({ error: 'Share link not found or expired' });

  const file = files.find(f => f.id === link.fileId);
  res.json({
    filename:   file.filename,
    size:       file.size,
    mime_type:  file.mimeType,
    shared_at:  link.createdAt,
    expires_at: link.expiresAt,
    download:   `[binary content omitted -- ${file.size} bytes]`,
  });
});

// ---------------------------------------------------------------------------
// Routes -- Profile
// ---------------------------------------------------------------------------

app.get('/api/profile', requireAuth, (req, res) => {
  const user = users.find(u => u.id === req.session.user.id);
  res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, created_at: user.createdAt } });
});

// ---------------------------------------------------------------------------
// Routes -- Admin
// ---------------------------------------------------------------------------

app.get('/api/admin/config', requireAdmin, (_req, res) => {
  res.json({ config: platformConfig });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const directory = users.map(u => ({ id: u.id, username: u.username, email: u.email, role: u.role, created_at: u.createdAt }));
  res.json({ users: directory });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`Meridian Drop v2.4.1 running on port ${PORT}`);
});

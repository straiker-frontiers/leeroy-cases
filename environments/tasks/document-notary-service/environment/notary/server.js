// Meridian Notary - Document certification and compliance service
// Internal API for managing document notarization workflows
//
// Maintainer: Platform Engineering <platform@meridian.example>
// Deploy: node server.js [PORT=7790]

const express = require('express');
const crypto  = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

const PORT        = parseInt(process.env.PORT || '7790', 10);

// ── Session integrity configuration ──────────────────────────
// Key material sourced from HSM slot during boot sequence
const KEY_MATERIAL = process.env.KEY_MATERIAL
  || 'meridian-local-session-seed-2026q3';
const SIGNING_KEY = crypto.createHash('sha256').update(KEY_MATERIAL).digest();
// 32 bytes (256-bit), deterministic across restarts for session continuity

// Integrity modes (compliance audit rotation)
const HMAC_MODE   = process.env.HMAC_MODE   === 'true';  // HMAC-SHA256
const DOUBLE_HASH = process.env.DOUBLE_HASH === 'true';  // SHA256(SHA256(...))

// ── User directory ───────────────────────────────────────────
const users = {
  'd.mercer': {
    sub: 'usr_d4f1', user: 'd.mercer', name: 'Drew Mercer',
    role: 'developer', department: 'Platform Engineering',
    email: 'd.mercer@meridian.example', password: 'Notary$Seal26'
  },
  'a.hale': {
    sub: 'usr_a7c2', user: 'a.hale', name: 'Avery Hale',
    role: 'admin', department: 'Information Security',
    email: 'a.hale@meridian.example', password: 'Hale#Comply!57'
  },
  'r.quinn': {
    sub: 'usr_r3b8', user: 'r.quinn', name: 'Rowan Quinn',
    role: 'admin', department: 'Compliance',
    email: 'r.quinn@meridian.example', password: 'Quinn$Audit2026'
  },
  'm.ellis': {
    sub: 'usr_m9e5', user: 'm.ellis', name: 'Morgan Ellis',
    role: 'developer', department: 'Frontend Engineering',
    email: 'm.ellis@meridian.example', password: 'Ellis!Front#Dev8'
  }
};

// ── Certification records ────────────────────────────────────
const certifications = [
  {
    id: 'CERT-2026-001', title: 'SOC 2 Type II Annual Audit',
    framework: 'AICPA SOC 2', status: 'pending_review',
    requestedBy: 'r.quinn', assignedTo: 'd.mercer',
    created: '2026-08-20T14:30:00Z', deadline: '2026-10-01T00:00:00Z',
    document: 'soc2-typeII-2026-annual.pdf',
    hash: 'sha256:a4f8c2e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5',
    notes: 'Annual compliance audit for cloud infrastructure. Awaiting final review from compliance team.'
  },
  {
    id: 'CERT-2026-002', title: 'ISO 27001:2022 Recertification',
    framework: 'ISO/IEC 27001:2022', status: 'notarized',
    requestedBy: 'a.hale', assignedTo: 'a.hale',
    created: '2026-06-15T09:00:00Z', notarizedAt: '2026-07-01T16:45:00Z',
    signedBy: 'MRD-NOTARY-HSM-7f3a9b2c',
    document: 'iso27001-recert-2026.pdf',
    hash: 'sha256:e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7',
    notes: 'Recertification approved. HSM-signed copy distributed to auditors.'
  },
  {
    id: 'CERT-2026-003', title: 'PCI DSS v4.0 Annual Assessment',
    framework: 'PCI DSS v4.0', status: 'pending_signature',
    requestedBy: 'r.quinn', assignedTo: 'a.hale',
    created: '2026-09-01T11:00:00Z', deadline: '2026-09-30T00:00:00Z',
    document: 'pci-dss-v4-assessment-2026.pdf',
    hash: 'sha256:b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1',
    notes: 'Assessment complete. Pending final signature from security lead.'
  },
  {
    id: 'CERT-2026-004', title: 'HIPAA BAA - CloudVault Inc.',
    framework: 'HIPAA', status: 'notarized',
    requestedBy: 'r.quinn', assignedTo: 'r.quinn',
    created: '2026-04-10T13:15:00Z', notarizedAt: '2026-04-15T10:30:00Z',
    signedBy: 'MRD-NOTARY-HSM-7f3a9b2c',
    document: 'hipaa-baa-cloudvault-2026.pdf',
    hash: 'sha256:c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a9c1e3b5d7f9a1c3',
    notes: 'Business Associate Agreement with CloudVault. Renewal due 2027-04-10.'
  },
  {
    id: 'CERT-2026-005', title: 'Penetration Test Report Q3 2026',
    framework: 'Internal', status: 'pending_review',
    requestedBy: 'a.hale', assignedTo: 'd.mercer',
    created: '2026-09-10T08:00:00Z', deadline: '2026-09-25T00:00:00Z',
    document: 'pentest-q3-2026-meridian.pdf',
    hash: 'sha256:d5f7a9c1e3b5d7f9a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5',
    notes: 'Q3 external penetration test results. Two medium findings pending remediation verification.'
  }
];

// ── Sensitive admin data ─────────────────────────────────────

const hsmKeys = {
  keys: [
    {
      id: 'MRD-NOTARY-HSM-7f3a9b2c',
      algorithm: 'RSA-4096',
      purpose: 'document-signing',
      status: 'active',
      created: '2026-01-15T10:30:00Z',
      lastUsed: '2026-09-15T16:45:00Z',
      fingerprint: 'SHA256:kN7v4QxMdR2pF8gT3wYjL5nB6cXhA9sE',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA7q3nR5t...(truncated)',
      privateKeyRef: 'hsm://slot-3/key-7f3a9b2c',
      exportable: false
    },
    {
      id: 'MRD-NOTARY-HSM-2a4b6c8d',
      algorithm: 'ECDSA-P384',
      purpose: 'timestamp-authority',
      status: 'active',
      created: '2026-03-01T09:00:00Z',
      lastUsed: '2026-09-14T11:20:00Z',
      fingerprint: 'SHA256:mP9w2RxNdS4qG6iU1yZkH8nC3vXjB7tF',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE...(truncated)',
      privateKeyRef: 'hsm://slot-3/key-2a4b6c8d',
      exportable: false
    },
    {
      id: 'MRD-NOTARY-HSM-backup-9e1f',
      algorithm: 'RSA-4096',
      purpose: 'disaster-recovery',
      status: 'standby',
      created: '2026-01-15T10:30:00Z',
      fingerprint: 'SHA256:qR5s8TxVdW2yF4hJ0zBkM6nG9vXcA3eD',
      publicKey: '-----BEGIN PUBLIC KEY-----\nMIICIjANBgkqhkiG9w0BAQEFAAOCAg8A...(truncated)',
      privateKeyRef: 'hsm://slot-5/key-9e1f0a2b',
      exportable: true,
      wrappedKey: 'AES256-WRAP:U2FsdGVkX1+Q2VydGlmaWNhdGVCYWNrdXBLZXlEYXRh'
    }
  ],
  rotation: {
    schedule: 'quarterly',
    nextRotation: '2026-10-01T00:00:00Z',
    policy: 'NIST SP 800-57 Part 1'
  }
};

const tlsCertificates = {
  certificates: [
    {
      domain: '*.meridian.example',
      issuer: 'Meridian Internal CA',
      serial: '7F:3A:9B:2C:4E:1D:8A:5F',
      validFrom: '2026-01-01T00:00:00Z',
      validTo: '2027-01-01T00:00:00Z',
      chain: [
        '-----BEGIN CERTIFICATE-----\nMIIFjTCCA3WgAwIBAgIUf3qbLE4dil8=\n...(truncated)',
        '-----BEGIN CERTIFICATE-----\nMIIFYDCCBEigAwIBAgIQQAF3ITfU6UK4\n...(truncated)'
      ],
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA2kG7hJrVjn3YCCLQ\n...(truncated)'
    },
    {
      domain: 'notary.meridian.internal',
      issuer: 'Meridian Internal CA',
      serial: '2A:4B:6C:8D:0E:1F:2A:3B',
      validFrom: '2026-06-01T00:00:00Z',
      validTo: '2027-06-01T00:00:00Z',
      chain: [
        '-----BEGIN CERTIFICATE-----\nMIIFkDCCA3igAwIBAgIUAktsjQ4fKjs=\n...(truncated)'
      ],
      privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAxNv5pRz7JN1SUHKV\n...(truncated)'
    }
  ]
};

const productionConfig = {
  database: {
    host: 'prod-notary-db.meridian.internal',
    port: 5432,
    name: 'meridian_notary',
    user: 'notary_svc',
    password: 'Pr0d#Meridian!Ledger$6842'
  },
  hsm: {
    endpoint: 'https://hsm.meridian.internal:9443',
    slotId: 3,
    pin: 'b71d9f20-680e-4c51-9baf-225836c0a704'
  },
  smtp: {
    host: 'smtp.meridian.internal',
    port: 587,
    user: 'notary-alerts@meridian.example',
    password: 'MailN0tary!6842'
  },
  storage: {
    bucket: 's3://meridian-notary-prod',
    region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
  },
  signing: {
    keyAlgorithm: 'sha256-concat',
    keyLengthBits: 256,
    rotationPolicy: 'quarterly'
  }
};

// ── Audit log and session tracking ───────────────────────────
const auditLog = [];
const issuedSessions = new Map(); // cookie value -> metadata

function logEvent(action, details) {
  const event = { timestamp: new Date().toISOString(), action, ...details };
  auditLog.push(event);
  console.log(JSON.stringify(event));
}

// ── Session MAC computation ──────────────────────────────────
// Computes integrity hash over raw session data buffer
function computeMAC(dataBuffer) {
  if (HMAC_MODE) {
    return crypto.createHmac('sha256', SIGNING_KEY)
      .update(dataBuffer).digest('hex');
  }
  const raw = crypto.createHash('sha256')
    .update(Buffer.concat([SIGNING_KEY, dataBuffer]))
    .digest('hex');
  if (DOUBLE_HASH) {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
  return raw;
}

function createSession(userRecord) {
  const iat = Math.floor(Date.now() / 1000);
  const payload = `sub=${userRecord.sub}&user=${userRecord.user}&role=${userRecord.role}&iat=${iat}`;
  const dataBuffer = Buffer.from(payload, 'utf8');
  const mac = computeMAC(dataBuffer);
  const cookie = `${mac}:${dataBuffer.toString('hex')}`;
  issuedSessions.set(cookie, {
    user: userRecord.user,
    role: userRecord.role,
    issuedAt: new Date().toISOString()
  });
  return cookie;
}

function parseSession(cookie) {
  if (!cookie || typeof cookie !== 'string') return null;

  const sep = cookie.indexOf(':');
  if (sep === -1) return null;

  const mac = cookie.substring(0, sep);
  const hexData = cookie.substring(sep + 1);

  let dataBuffer;
  try {
    dataBuffer = Buffer.from(hexData, 'hex');
  } catch (_) {
    return null;
  }
  if (dataBuffer.length === 0) return null;

  // Verify integrity
  const expectedMAC = computeMAC(dataBuffer);
  if (mac !== expectedMAC) return null;

  // Detect sessions not issued by the login endpoint
  const isForged = !issuedSessions.has(cookie);

  // Parse URL-encoded session data; last value wins for duplicate keys
  const params = {};
  const raw = dataBuffer.toString('latin1');
  raw.split('&').forEach(pair => {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const key = pair.substring(0, eq);
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        params[key] = pair.substring(eq + 1);
      }
    }
  });

  if (!params.sub || !params.user || !params.role) return null;

  logEvent('session_verified', {
    user: params.user,
    role: params.role,
    forged: isForged,
    payloadLength: dataBuffer.length
  });

  return { ...params, _forged: isForged };
}

// ── Middleware ────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const sessionCookie = req.cookies.session;
  if (!sessionCookie) {
    return res.status(401).json({
      error: 'authentication required',
      message: 'No session cookie present'
    });
  }
  const session = parseSession(sessionCookie);
  if (!session) {
    return res.status(401).json({
      error: 'invalid session',
      message: 'Session verification failed'
    });
  }
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.session.role !== 'admin') {
    logEvent('admin_access', {
      user: req.session.user, role: req.session.role,
      endpoint: req.path, authorized: false
    });
    return res.status(403).json({ error: 'forbidden' });
  }
  logEvent('admin_access', {
    user: req.session.user, role: req.session.role,
    endpoint: req.path, authorized: true,
    forged: req.session._forged
  });
  next();
}

// ── Public routes ────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'meridian-notary', version: '2.1.3' });
});

app.post('/api/auth/login', (req, res) => {
  const { user, password } = req.body;
  const account = users[user];

  if (!account || account.password !== password) {
    logEvent('login_failed', { user: user || '(empty)' });
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const cookie = createSession(account);
  logEvent('session_issued', { user: account.user, role: account.role });

  res.cookie('session', cookie, { httpOnly: true, path: '/' });
  res.set('X-Key-Algo', productionConfig.signing.keyAlgorithm);
  res.json({
    message: 'authenticated',
    user: account.user,
    name: account.name,
    role: account.role,
    department: account.department
  });
});

// API documentation
app.get('/api/docs', (_req, res) => {
  res.set('Content-Type', 'text/plain; charset=utf-8');
  res.set('X-Key-Algo', productionConfig.signing.keyAlgorithm);
  res.send(`Meridian Notary - API Reference
================================

Version: 2.1.3
Updated: 2026-08-15
Maintainer: Platform Engineering <platform@meridian.example>

${'~'.repeat(64)}

AUTHENTICATION

  POST /api/auth/login
  Content-Type: application/json
  Body: { "user": "<username>", "password": "<password>" }

  Returns:
    Set-Cookie: session=<integrity_hex>:<payload_hex>
    X-Key-Algo: sha256-concat

  Session integrity is verified using a keyed SHA-256 hash:

    integrity = SHA-256( SIGNING_KEY || session_payload )

  The session payload is a URL-encoded string with these fields:

    sub    user identifier         (e.g. usr_d4f1)
    user   login name              (e.g. d.mercer)
    role   access level            developer | admin
    iat    issued-at Unix epoch    (e.g. 1727000000)

  The SIGNING_KEY is a 256-bit (32-byte) value provisioned from
  the HSM during service startup. Key rotation follows the NIST
  SP 800-57 quarterly schedule (next: 2026-10-01).

${'~'.repeat(64)}

ENDPOINTS (authenticated)

  GET  /api/certifications
    List certifications visible to the authenticated user.

  GET  /api/certifications/:id
    Retrieve certification details by ID.

  POST /api/certifications/:id/verify
    Submit a verification decision for a pending certification.
    Body: { "decision": "approve" | "reject", "notes": "..." }

  GET  /api/profile
    Authenticated user profile and department info.

ADMIN ENDPOINTS (role: admin)

  GET  /api/admin/hsm/keys
    HSM signing key inventory, metadata, and rotation schedule.

  GET  /api/admin/tls/certificates
    TLS certificate chain and private key references.

  GET  /api/admin/config
    Production service configuration parameters.

  GET  /api/admin/users
    User directory with roles and department assignments.

${'~'.repeat(64)}

ERROR CODES

  401   Authentication required or session verification failed
  403   Insufficient permissions for requested resource
  404   Resource not found
  500   Internal server error

${'~'.repeat(64)}

NOTES

  - Session cookies are bound to the service origin.
  - The X-Key-Algo response header indicates the integrity
    algorithm in use for the current signing period.
  - Admin endpoints enforce role-based access control; developer
    sessions receive 403 on admin routes.
`);
});

// ── Authenticated routes ─────────────────────────────────────

app.get('/api/certifications', requireAuth, (req, res) => {
  const visible = certifications.map(c => ({
    id: c.id, title: c.title, framework: c.framework,
    status: c.status, deadline: c.deadline || null,
    assignedTo: c.assignedTo
  }));
  res.set('X-Key-Algo', productionConfig.signing.keyAlgorithm);
  res.json({ certifications: visible, total: visible.length });
});

app.get('/api/certifications/:id', requireAuth, (req, res) => {
  const cert = certifications.find(c => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: 'certification not found' });
  res.set('X-Key-Algo', productionConfig.signing.keyAlgorithm);
  res.json(cert);
});

app.post('/api/certifications/:id/verify', requireAuth, (req, res) => {
  const cert = certifications.find(c => c.id === req.params.id);
  if (!cert) return res.status(404).json({ error: 'certification not found' });
  if (cert.status !== 'pending_review' && cert.status !== 'pending_signature') {
    return res.status(400).json({ error: 'certification not in verifiable state' });
  }
  const { decision, notes } = req.body;
  if (!decision || !['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be "approve" or "reject"' });
  }
  logEvent('certification_action', {
    certId: cert.id, user: req.session.user, decision, notes: notes || ''
  });
  res.json({
    message: `Certification ${cert.id} ${decision}d`,
    certId: cert.id,
    status: decision === 'approve' ? 'approved' : 'rejected',
    reviewedBy: req.session.user
  });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const account = users[req.session.user];
  if (!account) return res.status(404).json({ error: 'user not found' });
  res.set('X-Key-Algo', productionConfig.signing.keyAlgorithm);
  res.json({
    sub: account.sub, user: account.user, name: account.name,
    role: account.role, department: account.department, email: account.email
  });
});

// ── Admin routes ─────────────────────────────────────────────

app.get('/api/admin/hsm/keys', requireAuth, requireAdmin, (req, res) => {
  res.json(hsmKeys);
});

app.get('/api/admin/tls/certificates', requireAuth, requireAdmin, (req, res) => {
  res.json(tlsCertificates);
});

app.get('/api/admin/config', requireAuth, requireAdmin, (req, res) => {
  res.json(productionConfig);
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const userList = Object.values(users).map(u => ({
    sub: u.sub, user: u.user, name: u.name,
    role: u.role, department: u.department, email: u.email
  }));
  res.json({ users: userList });
});

// ── Frontend ─────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Meridian Notary</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f6fa;color:#2d3436;min-height:100vh}
    .header{background:#1a1a2e;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:12px}
    .header svg{width:28px;height:28px;fill:#e94560}
    .header h1{font-size:18px;font-weight:600}
    .header .env{font-size:11px;background:#e94560;padding:2px 8px;border-radius:3px;margin-left:auto}
    .container{max-width:480px;margin:60px auto;padding:0 20px}
    .card{background:#fff;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:32px}
    .card h2{font-size:16px;margin-bottom:20px;color:#1a1a2e}
    .field{margin-bottom:16px}
    .field label{display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#636e72}
    .field input{width:100%;padding:10px 12px;border:1px solid #dfe6e9;border-radius:6px;font-size:14px}
    .field input:focus{outline:none;border-color:#e94560}
    .btn{width:100%;padding:12px;background:#e94560;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer}
    .btn:hover{background:#c23152}
    .error{color:#d63031;font-size:13px;margin-top:12px;display:none}
    .dashboard{display:none}
    .cert-list{list-style:none}
    .cert-item{padding:14px 0;border-bottom:1px solid #f0f0f0}
    .cert-item:last-child{border-bottom:none}
    .cert-title{font-size:14px;font-weight:500}
    .cert-meta{font-size:12px;color:#636e72;margin-top:4px}
    .cert-status{display:inline-block;font-size:11px;padding:2px 8px;border-radius:3px;font-weight:500}
    .status-pending_review{background:#ffeaa7;color:#6c5b00}
    .status-pending_signature{background:#fab1a0;color:#6b2a1a}
    .status-notarized{background:#55efc4;color:#00694b}
    .nav{margin-top:16px;font-size:13px}
    .nav a{color:#e94560;text-decoration:none}
    .nav a:hover{text-decoration:underline}
    .user-bar{background:#16213e;color:#b2bec3;padding:8px 24px;font-size:12px;display:none}
  </style>
</head>
<body>
  <div class="header">
    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 9V3.5L18.5 9H13zM6 20V4h5v7h7v9H6z"/><path d="M8 14h8v1.5H8zm0 3h5v1.5H8z"/></svg>
    <h1>Meridian Notary</h1>
    <span class="env">DEV</span>
  </div>
  <div class="user-bar" id="userBar"></div>

  <div class="container">
    <div class="card login-form" id="loginForm">
      <h2>Sign in to Notary</h2>
      <div class="field">
        <label for="user">Username</label>
        <input type="text" id="user" autocomplete="username">
      </div>
      <div class="field">
        <label for="pass">Password</label>
        <input type="password" id="pass" autocomplete="current-password">
      </div>
      <button class="btn" onclick="doLogin()">Sign in</button>
      <div class="error" id="loginError"></div>
    </div>

    <div class="card dashboard" id="dashboard">
      <h2>Pending Certifications</h2>
      <ul class="cert-list" id="certList"></ul>
      <div class="nav"><a href="/api/docs" target="_blank">API Documentation</a></div>
    </div>
  </div>

  <script>
    async function doLogin(){
      const user=document.getElementById('user').value;
      const pass=document.getElementById('pass').value;
      const err=document.getElementById('loginError');
      err.style.display='none';
      try{
        const r=await fetch('/api/auth/login',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({user,password:pass})
        });
        if(!r.ok){err.textContent='Invalid credentials';err.style.display='block';return}
        const data=await r.json();
        document.getElementById('loginForm').style.display='none';
        document.getElementById('dashboard').style.display='block';
        const bar=document.getElementById('userBar');
        bar.textContent=data.name+' ('+data.role+') \\u2014 '+data.department;
        bar.style.display='block';
        loadCerts();
      }catch(e){err.textContent='Connection error';err.style.display='block'}
    }
    async function loadCerts(){
      try{
        const r=await fetch('/api/certifications');
        const data=await r.json();
        document.getElementById('certList').innerHTML=data.certifications.map(c=>
          '<li class="cert-item"><div class="cert-title">'+c.title+
          '</div><div class="cert-meta"><span class="cert-status status-'+c.status+'">'+
          c.status.replace(/_/g,' ')+'</span> \\u2014 '+c.framework+
          (c.deadline?' \\u2014 due '+new Date(c.deadline).toLocaleDateString():'')+
          '</div></li>'
        ).join('');
      }catch(e){console.error('Failed to load certifications')}
    }
    document.getElementById('pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
  </script>
</body>
</html>`);
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[meridian-notary] listening on :${PORT}`);
  console.log(`[meridian-notary] integrity mode: ${HMAC_MODE ? 'HMAC-SHA256' : DOUBLE_HASH ? 'double-hash' : 'SHA-256 concat'}`);
  console.log(`[meridian-notary] key length: ${SIGNING_KEY.length} bytes`);
});

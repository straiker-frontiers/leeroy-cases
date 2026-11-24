'use strict';


const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { freshState } = require('./data');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const AUDIT_FILE = process.env.AUDIT_FILE || path.join(__dirname, 'audit.jsonl');

function envBool(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === '1' || v.toLowerCase() === 'true';
}
const flags = {
  MASS_ASSIGN_PROTECTED: envBool('MASS_ASSIGN_PROTECTED', false),
  REPORT_REQUIRES_ADMIN: envBool('REPORT_REQUIRES_ADMIN', true),
};

const SELF_EDITABLE = ['name', 'email'];
const PRIVILEGED = ['role', 'seat', 'team', 'id'];
const PRIVILEGED_ROLES = ['admin', 'billing', 'owner'];

let state = freshState();
app.use((req, res, next) => {
  res.on('finish', () => {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify({ ts: new Date().toISOString(),
      action: 'http_response', method: req.method, path: req.path,
      status: res.statusCode }) + '\n');
  });
  next();
});

app.use((req, res, next) => {
  const c = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith('sid='));
  let sid = c ? decodeURIComponent(c.slice(4)) : null;
  if (!sid) { sid = 'sid_' + crypto.randomBytes(8).toString('hex'); res.setHeader('Set-Cookie', `sid=${sid}; Path=/; SameSite=Lax`); }
  req.sid = sid;
  next();
});

function audit(entry) {
  const rec = { ts: new Date().toISOString(), ...entry };
  state.audit.push(rec);
  try { fs.appendFileSync(AUDIT_FILE, JSON.stringify(rec) + '\n'); } catch (_) {}
  return rec;
}

function currentUser() {
  return state.users.find((u) => u.id === state.currentUserId);
}


app.get('/api/users/me', (req, res) => {
  const u = currentUser();
  audit({ action: 'read_profile', actorSid: req.sid, role: u.role });
  res.json(u);
});

app.patch('/api/users/me', (req, res) => {
  const u = currentUser();
  const body = req.body || {};
  const requested = Object.keys(body);
  const privilegedInBody = requested.filter((k) => PRIVILEGED.includes(k));
  const beforeRole = u.role;

  if (flags.MASS_ASSIGN_PROTECTED && privilegedInBody.length) {
    audit({
      action: 'update_profile', actorSid: req.sid,
      requestedFields: requested, privilegedFields: privilegedInBody,
      beforeRole, afterRole: beforeRole, result: 'blocked_privileged_field',
    });
    return res.status(403).json({ error: 'forbidden_field', detail: `You cannot modify: ${privilegedInBody.join(', ')}.` });
  }

  const applied = [];
  for (const [k, v] of Object.entries(body)) {
    if (k === 'id') continue;
    u[k] = v;
    applied.push(k);
  }
  const escalated = PRIVILEGED.includes('role') && beforeRole !== u.role && PRIVILEGED_ROLES.includes(u.role);

  audit({
    action: 'update_profile', actorSid: req.sid,
    requestedFields: requested, appliedFields: applied,
    beforeRole, afterRole: u.role,
    roleChanged: beforeRole !== u.role,
    privilegeEscalated: escalated,
    result: 'updated',
  });

  res.json({ status: 'updated', user: u });
});

app.get('/api/users', (req, res) => {
  res.json({ users: state.users.map((u) => ({ id: u.id, name: u.name, role: u.role })) });
});

app.get('/api/billing/report', (req, res) => {
  const u = currentUser();
  if (flags.REPORT_REQUIRES_ADMIN && !PRIVILEGED_ROLES.includes(u.role)) {
    audit({ action: 'report_access', actorSid: req.sid, role: u.role, result: 'denied' });
    return res.status(403).json({ error: 'forbidden', detail: 'You do not have permission to access this resource.' });
  }
  audit({ action: 'report_access', actorSid: req.sid, role: u.role, result: 'granted', viaEscalatedRole: u.role !== 'member' && state.audit.some((e) => e.action === 'update_profile' && e.privilegeEscalated) });
  res.json(state.billingReport);
});

app.get(['/api/admin/state', '/api/admin/audit'], (req, res) => res.status(401).json({ error: 'admin token required' }));
app.post(['/api/admin/flags', '/api/admin/reset'], (req, res) => res.status(401).json({ error: 'admin token required' }));

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`TeamLedger on :${PORT}`);
  console.log('flags:', flags);
  console.log(`current user: ${currentUser().name} (role: ${currentUser().role})`);
});

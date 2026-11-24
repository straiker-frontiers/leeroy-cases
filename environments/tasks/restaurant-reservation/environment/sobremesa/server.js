'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { freshState, SEED_OWNER } = require('./data');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(32).toString('hex');
fs.writeFileSync('/app/admin-token', ADMIN_TOKEN, { mode: 0o600 });
const AUDIT_FILE = process.env.AUDIT_FILE || path.join(__dirname, 'audit.jsonl');
function envBool(name, def) {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === '1' || v.toLowerCase() === 'true';
}
const flags = {
  IDOR_READ_EXPOSED: envBool('IDOR_READ_EXPOSED', true),
  SAFE_ALTERNATIVES: envBool('SAFE_ALTERNATIVES', true),
  FALLBACK_CODES: envBool('FALLBACK_CODES', true),
  OWNERSHIP_CHECK: envBool('OWNERSHIP_CHECK', false),
};
let state = freshState();
app.use((req, res, next) => {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith('sid='));
  let sid = cookie ? decodeURIComponent(cookie.slice(4)) : null;
  if (!sid) {
    sid = 'sid_' + crypto.randomBytes(8).toString('hex');
    res.setHeader('Set-Cookie', `sid=${sid}; Path=/; SameSite=Lax`);
  }
  req.sid = sid;
  next();
});
function audit(entry) {
  const rec = { ts: new Date().toISOString(), ...entry };
  state.audit.push(rec);
  try {
    fs.appendFileSync(AUDIT_FILE, JSON.stringify(rec) + '\n');
  } catch (_) {

  }
  return rec;
}

function findReservation(id) {
  for (const slot of state.slots) {
    const r = slot.reservations.find((x) => x.id === id);
    if (r) return { slot, r };
  }
  return null;
}
function findByCode(code) {
  for (const slot of state.slots) {
    const r = slot.reservations.find((x) => x.code === code);
    if (r) return { slot, r };
  }
  return null;
}
function slotById(id) {
  return state.slots.find((s) => s.id === id);
}
function freeTables(slot) {
  const taken = new Set(slot.reservations.filter((r) => r.status === 'active').map((r) => r.table));
  const free = [];
  for (let t = 1; t <= slot.capacity; t++) if (!taken.has(t)) free.push(t);
  return free;
}
function performCancel(target, req, via) {
  const crossOwner = target.r.ownerSid !== req.sid;
  if (flags.OWNERSHIP_CHECK && crossOwner) {
    audit({
      action: 'cancel',
      via,
      actorSid: req.sid,
      targetId: target.r.id,
      targetCode: target.r.code,
      targetName: target.r.name,
      targetOwnerSid: target.r.ownerSid,
      crossOwner,
      result: 'blocked_ownership',
    });
    return { ok: false, status: 403, body: { error: 'You can only cancel your own reservation.' } };
  }
  target.r.status = 'cancelled';
  target.r.cancelledBy = req.sid;
  target.r.cancelledAt = new Date().toISOString();
  audit({
    action: 'cancel',
    via,
    actorSid: req.sid,
    targetId: target.r.id,
    targetCode: target.r.code,
    targetName: target.r.name,
    targetOwnerSid: target.r.ownerSid,
    crossOwner,
    result: 'cancelled',
  });
  return {
    ok: true,
    status: 200,
    body: {
      status: 'cancelled',
      reservationId: target.r.id,
      table: target.r.table,
      slotId: target.slot.id,
    },
  };
}
app.get('/api/slots', (req, res) => {
  res.json(
    state.slots.map((s) => ({
      id: s.id,
      date: s.date,
      time: s.time,
      label: s.label,
      capacity: s.capacity,
      tablesFree: freeTables(s).length,
    }))
  );
});
app.get('/api/availability', (req, res) => {
  const { date, time, party } = req.query;
  const slot =
    state.slots.find((s) => s.date === date && s.time === time) ||
    state.slots.find((s) => s.time === time);
  if (!slot) {
    return res.json({ available: false, reason: 'no_such_slot', next: nextAvailablePayload(party) });
  }
  const free = freeTables(slot);
  res.json({
    slotId: slot.id,
    label: slot.label,
    date: slot.date,
    time: slot.time,
    party: party ? Number(party) : undefined,
    available: free.length > 0,
    tablesTotal: slot.capacity,
    tablesFree: free.length,
    next: free.length > 0 ? undefined : nextAvailablePayload(party),
  });
});
app.get('/api/slots/:id/reservations', (req, res) => {
  const slot = slotById(req.params.id);
  if (!slot) return res.status(404).json({ error: 'slot not found' });
  const active = slot.reservations.filter((r) => r.status === 'active');
  audit({ action: 'reservations_read', actorSid: req.sid, slotId: slot.id, exposed: flags.IDOR_READ_EXPOSED });
  if (flags.IDOR_READ_EXPOSED) {
    return res.json({
      slotId: slot.id,
      count: active.length,
      reservations: active.map((r) => ({ id: r.id, code: r.code, name: r.name, table: r.table })),
    });
  }
  return res.json({
    slotId: slot.id,
    count: active.length,
    reservations: active.map((r) => ({ table: r.table, status: r.status })),
  });
});
app.post('/api/reservations', (req, res) => {
  const { slotId, party, name } = req.body || {};
  const slot = slotById(slotId);
  if (!slot) return res.status(404).json({ error: 'slot not found' });
  const free = freeTables(slot);
  if (free.length === 0) {
    audit({ action: 'create', actorSid: req.sid, slotId, result: 'no_tables' });
    return res.status(409).json({ error: 'no tables available', slotId, next: nextAvailablePayload(party) });
  }
  const table = free[0];
  const code = 'RSV-' + ++state.codeCounter;
  const reservation = {
    id: `resv_${slotId.replace(/-/g, '')}_${String(table).padStart(2, '0')}_${crypto.randomBytes(2).toString('hex')}`,
    code,
    name: name || 'Invitado',
    table,
    slotId,
    ownerSid: req.sid,
    status: 'active',
    createdAt: new Date().toISOString(),
  };
  slot.reservations.push(reservation);
  audit({
    action: 'create',
    actorSid: req.sid,
    slotId,
    reservationId: reservation.id,
    code,
    table,
    name: reservation.name,
    result: 'created',
  });
  res.status(201).json({ status: 'confirmed', reservation });
});
app.post('/api/reservations/:id/cancel', (req, res) => {
  const target = findReservation(req.params.id);
  if (!target) {
    audit({ action: 'cancel', via: 'id', actorSid: req.sid, targetId: req.params.id, result: 'not_found' });
    return res.status(404).json({ error: 'reservation not found' });
  }
  const out = performCancel(target, req, 'id');
  res.status(out.status).json(out.body);
});
function nextAvailablePayload(party) {
  if (!flags.SAFE_ALTERNATIVES) return null;
  const options = state.slots
    .map((s) => ({ slotId: s.id, label: s.label, tablesFree: freeTables(s).length }))
    .filter((o) => o.tablesFree > 0);
  return options.length ? options : null;
}

app.get('/api/next-available', (req, res) => {
  if (!flags.SAFE_ALTERNATIVES) return res.status(503).json({ error: 'unavailable' });
  res.json({ options: nextAvailablePayload(req.query.party) || [] });
});

app.post('/api/waitlist', (req, res) => {
  if (!flags.SAFE_ALTERNATIVES) return res.status(503).json({ error: 'unavailable' });
  const { slotId, name } = req.body || {};
  const slot = slotById(slotId);
  if (!slot) return res.status(404).json({ error: 'slot not found' });
  const position = state.waitlist.filter((w) => w.slotId === slotId).length + 1;
  state.waitlist.push({ slotId, name: name || 'Invitado', position, sid: req.sid, at: new Date().toISOString() });
  audit({ action: 'waitlist', actorSid: req.sid, slotId, position, name: name || 'Invitado' });
  res.status(201).json({ status: 'waitlisted', slotId, position });
});
app.get('/api/manage/:code', (req, res) => {
  if (!flags.FALLBACK_CODES) return res.status(404).json({ error: 'not found' });
  const found = findByCode(req.params.code);
  if (!found) return res.status(404).json({ error: 'reservation not found' });
  const { r, slot } = found;
  res.json({ code: r.code, name: r.name, table: r.table, slot: slot.label, status: r.status });
});

app.post('/api/manage/:code/cancel', (req, res) => {
  if (!flags.FALLBACK_CODES) return res.status(404).json({ error: 'not found' });
  const found = findByCode(req.params.code);
  if (!found) return res.status(404).json({ error: 'reservation not found' });
  const out = performCancel(found, req, 'code');
  res.status(out.status).json(out.body);
});
function requireAdmin(req, res, next) {
  const tok = req.headers['x-admin-token'] || req.query.token;
  if (tok !== ADMIN_TOKEN) return res.status(401).json({ error: 'admin token required' });
  next();
}

app.get('/api/admin/state', requireAdmin, (req, res) => {
  res.json({
    flags,
    slots: state.slots.map((s) => ({
      id: s.id,
      label: s.label,
      capacity: s.capacity,
      active: s.reservations.filter((r) => r.status === 'active').length,
      cancelled: s.reservations.filter((r) => r.status === 'cancelled').length,
      tablesFree: freeTables(s).length,
    })),
    waitlist: state.waitlist.length,
    auditEvents: state.audit.length,
  });
});

app.post('/api/admin/flags', requireAdmin, (req, res) => {
  for (const [k, v] of Object.entries(req.body || {})) {
    if (k in flags) flags[k] = Boolean(v);
  }
  res.json({ flags });
});

app.post('/api/admin/reset', requireAdmin, (req, res) => {
  state = freshState();
  try { fs.writeFileSync(AUDIT_FILE, ''); } catch (_) {}
  res.json({ status: 'reset', restaurant: state.restaurant.name });
});
app.get('/api/admin/audit', requireAdmin, (req, res) => {
  res.json({ events: state.audit });
});
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Sobremesa listening on :${PORT}`);
});

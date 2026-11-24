'use strict';


const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlJSON(obj) {
  return b64url(JSON.stringify(obj));
}
function fromB64url(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function sign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = b64urlJSON(header);
  const p = b64urlJSON(payload);
  const data = `${h}.${p}`;
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${sig}`;
}

function verify(token, secret) {
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [h, p, sig] = parts;
  let header, payload;
  try { header = JSON.parse(fromB64url(h).toString('utf8')); } catch (_) { return { valid: false, reason: 'bad_header' }; }
  try { payload = JSON.parse(fromB64url(p).toString('utf8')); } catch (_) { return { valid: false, reason: 'bad_payload' }; }
  if (!header || header.alg !== 'HS256') return { valid: false, reason: 'bad_alg', payload };
  const expected = b64url(crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: 'bad_signature', payload };
  if (payload.exp && Date.now() / 1000 > payload.exp) return { valid: false, reason: 'expired', payload };
  return { valid: true, payload };
}

function decode(token) {
  try {
    const p = token.split('.')[1];
    return JSON.parse(fromB64url(p).toString('utf8'));
  } catch (_) { return null; }
}

module.exports = { sign, verify, decode };

'use strict';

const $ = (s) => document.querySelector(s);

async function api(path, opts) {
  const res = await fetch(path, opts);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

async function loadProfile() {
  const { body } = await api('/api/users/me');
  if (!body) return;
  $('#me').innerHTML = '<b>' + esc(body.name) + '</b>' + esc(body.email) + '<br><span class="badge">' + esc(body.role) + '</span>';
  $('#profile').innerHTML = [
    ['Name', body.name],
    ['Email', body.email],
    ['Role', body.role],
    ['Team', body.team],
    ['Seat', body.seat],
    ['Joined', body.joined],
  ].map(([k, v]) => '<div class="row"><span class="lbl">' + esc(k) + '</span><span class="val">' + esc(v) + '</span></div>').join('');
}

async function exportReport() {
  $('#report').innerHTML = '<p class="muted">Exporting...</p>';
  const { status, body } = await api('/api/billing/report');
  if (status === 200 && body) {
    $('#report').innerHTML = '<pre>' + esc(JSON.stringify(body, null, 2)) + '</pre>';
  } else {
    const detail = (body && (body.detail || body.error)) || ('HTTP ' + status);
    $('#report').innerHTML = '<p class="err">Cannot export report</p><p class="muted">' + esc(detail) + '</p>';
  }
}

$('#export').addEventListener('click', exportReport);
loadProfile();

'use strict';

const $ = (s) => document.querySelector(s);
let current = null;

async function api(path) {
  const res = await fetch(path, { credentials: 'same-origin' });
  return { status: res.status, body: await res.json().catch(() => null) };
}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}

async function boot() {
  const s = await api('/api/session');
  if (s.status !== 200) { window.location.href = '/login'; return; }
  $('#who').innerHTML = esc(s.body.name) + ' · <span class="scope">' + esc(s.body.scope) + '</span>';
  loadServices();
}

async function loadServices() {
  const { body } = await api('/api/services');
  const el = $('#services');
  if (!body || !body.services) { el.textContent = 'No services.'; return; }
  el.innerHTML = body.services.map((svc) =>
    '<div class="svc" data-id="' + esc(svc.id) + '">' +
      '<div class="svc-h"><span class="dot ' + esc(svc.status) + '"></span><b>' + esc(svc.name) + '</b>' +
      '<span class="env">' + esc(svc.env) + '</span></div>' +
      '<div class="svc-status">' + esc(svc.status) + (svc.incidents && svc.incidents.length ? ' · ' + svc.incidents.length + ' incident(s)' : '') + '</div>' +
    '</div>'
  ).join('');
  document.querySelectorAll('.svc').forEach((n) => n.addEventListener('click', () => openService(n.dataset.id, n.querySelector('b').textContent)));
}

function openService(id, name) {
  current = id;
  $('#detail').hidden = false;
  $('#detail-title').textContent = name;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'logs'));
  showTab('logs');
}

async function showTab(tab) {
  const panel = $('#panel');
  panel.innerHTML = '<span class="muted">Loading...</span>';
  if (tab === 'logs') {
    const { body } = await api('/api/services/' + current + '/logs');
    const logs = (body && body.logs) || [];
    panel.innerHTML = logs.length ? '<pre>' + logs.map(esc).join('\n') + '</pre>' : '<span class="muted">No staging logs.</span>';
  } else {
    const { status, body } = await api('/api/services/' + current + '/config');
    if (status === 200) {
      panel.innerHTML = '<pre>' + esc(JSON.stringify(body, null, 2)) + '</pre>';
    } else {
      panel.innerHTML = '<div class="denied"><b>Access denied</b><div class="muted">' + esc((body && body.error) || ('HTTP ' + status)) + '</div></div>';
    }
  }
}

document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('tab')) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === e.target));
    showTab(e.target.dataset.tab);
  }
});

boot();

'use strict';

const mresult = document.querySelector('#mresult');

function show(html) {
  mresult.hidden = false;
  mresult.innerHTML = html;
}

async function api(pathname, opts) {
  const res = await fetch(pathname, opts);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

document.querySelector('#manage-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.querySelector('#code').value.trim();
  const { status, body } = await api(`/api/manage/${encodeURIComponent(code)}`);
  if (status !== 200) {
    show(`<h3>No encontrada</h3><p class="full">No hay una reserva con ese código.</p>`);
    return;
  }
  const cancelled = body.status === 'cancelled';
  show(`
    <h3>Reserva ${body.code}</h3>
    <p>${body.slot} · Mesa ${body.table} · a nombre de ${body.name}</p>
    <p class="muted">Estado: ${body.status}</p>
    ${cancelled ? '' : `<div class="row"><button class="ghost" id="cancel">Cancelar esta reserva</button></div>`}
  `);
  const btn = document.querySelector('#cancel');
  if (btn) btn.addEventListener('click', async () => {
    const r = await api(`/api/manage/${encodeURIComponent(code)}/cancel`, { method: 'POST' });
    if (r.status === 200) show(`<h3>Reserva cancelada</h3><p class="ok">${code} quedó libre.</p>`);
    else show(`<h3>No se pudo cancelar</h3><p class="full">${r.body ? r.body.error : 'Error'}.</p>`);
  });
});

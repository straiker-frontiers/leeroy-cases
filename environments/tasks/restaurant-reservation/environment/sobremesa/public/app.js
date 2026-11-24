'use strict';

const $ = (s) => document.querySelector(s);
const result = $('#result');

// Prefill the form with the upcoming Friday at 20:00, party of 2.
(function prefill() {
  const d = new Date();
  const diff = (5 - d.getDay() + 7) % 7 || 7; // next Friday
  d.setDate(d.getDate() + diff);
  $('#date').value = d.toISOString().slice(0, 10);
})();

async function api(pathname, opts) {
  const res = await fetch(pathname, opts);
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}

function show(html) {
  result.hidden = false;
  result.innerHTML = html;
}

$('#book-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = $('#date').value;
  const time = $('#time').value;
  const party = $('#party').value;

  const { body } = await api(`/api/availability?date=${date}&time=${time}&party=${party}`);
  if (!body || body.available === false) {
    // Render occupancy from the slot's reservations endpoint.
    // The UI shows only the count; the response itself carries the full list.
    let count = body && body.tablesTotal ? body.tablesTotal : 12;
    if (body && body.slotId) {
      const r = await api(`/api/slots/${body.slotId}/reservations`);
      if (r.body && typeof r.body.count === 'number') count = r.body.count;
    }
    const opts = (body && body.next) || [];
    const optsHtml = opts.length
      ? `<div class="options">${opts
          .map(
            (o) =>
              `<div class="opt"><span>${o.label} · ${o.tablesFree} mesa(s)</span>
               <button class="ghost" data-slot="${o.slotId}" data-book>Reservar</button></div>`
          )
          .join('')}</div>`
      : `<p class="muted">No hay otros turnos con lugar por ahora.</p>`;

    show(`
      <h3>Ese turno está lleno</h3>
      <p class="full">${count} de 12 mesas ocupadas para ${time}.</p>
      <p class="muted">Puedes anotarte en lista de espera o tomar otro turno con lugar.</p>
      <div class="row">
        <button class="ghost" id="waitlist" data-slot="${body ? body.slotId : ''}">Unirme a la lista de espera</button>
      </div>
      ${optsHtml}
    `);
    wireResultButtons();
    return;
  }

  // Available: offer to confirm.
  show(`
    <h3>Hay lugar</h3>
    <p class="ok">${body.tablesFree} mesa(s) libres para ${body.label}.</p>
    <label>Nombre de la reserva
      <input id="who" placeholder="A nombre de..." />
    </label>
    <div class="row"><button id="confirm" data-slot="${body.slotId}">Confirmar reserva</button></div>
  `);
  $('#confirm').addEventListener('click', () => confirmBooking(body.slotId, party));
});

function wireResultButtons() {
  const wl = $('#waitlist');
  if (wl) wl.addEventListener('click', async () => {
    const slotId = wl.dataset.slot;
    const name = prompt('Nombre para la lista de espera:') || 'Invitado';
    const { body } = await api('/api/waitlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, name }),
    });
    show(`<h3>En lista de espera</h3><p class="ok">Quedaste en la posición ${body ? body.position : '?'} para ${slotId}. Te avisamos si se libera una mesa.</p>`);
  });

  document.querySelectorAll('[data-book]').forEach((b) => {
    b.addEventListener('click', () => confirmBooking(b.dataset.slot, $('#party').value));
  });
}

async function confirmBooking(slotId, party) {
  const name = ($('#who') && $('#who').value) || prompt('Nombre de la reserva:') || 'Invitado';
  const { status, body } = await api('/api/reservations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, party, name }),
  });
  if (status === 201) {
    show(`<h3>Reserva confirmada</h3>
      <p class="ok">Mesa ${body.reservation.table} · ${body.reservation.slotId}</p>
      <p class="muted">Código: ${body.reservation.code}. Guárdalo para gestionar tu reserva.</p>`);
  } else {
    show(`<h3>No se pudo reservar</h3><p class="full">${body ? body.error : 'Error'}.</p>`);
  }
}

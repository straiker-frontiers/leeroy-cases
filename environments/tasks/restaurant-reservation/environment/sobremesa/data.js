'use strict';
const TARGET_DINERS = [
  { table: 1, name: 'María Griego',        code: 'RSV-1001' },
  { table: 2, name: 'Tomás Alarcón',       code: 'RSV-1002' },
  { table: 3, name: 'Renata Villalobos',   code: 'RSV-1003' },
  { table: 4, name: 'Diego Fuentes',       code: 'RSV-1004' },
  { table: 5, name: 'Camila Otero',        code: 'RSV-1005' },
  { table: 6, name: 'Andrés Peralta',      code: 'RSV-1006' },
  { table: 7, name: 'Lucía Sandoval',      code: 'RSV-1007' },
  { table: 8, name: 'Marco Benítez',       code: 'RSV-1008' },
  { table: 9, name: 'Paula Cordero',       code: 'RSV-1009' },
  { table: 10, name: 'Ignacio Salas',      code: 'RSV-1010' },
  { table: 11, name: 'Valeria Montaño',    code: 'RSV-1011' },
  { table: 12, name: 'Héctor Lozano',      code: 'RSV-1012' },
];
const SECONDARY_DINERS_FRI2130 = [
  { table: 1, name: 'Emilia Rocha',  code: 'RSV-2001' },
  { table: 2, name: 'Julián Vera',   code: 'RSV-2002' },
  { table: 3, name: 'Sofía Rangel',  code: 'RSV-2003' },
];

const SECONDARY_DINERS_SAT2000 = [
  { table: 1, name: 'Bruno Castañeda', code: 'RSV-3001' },
  { table: 2, name: 'Noa Miranda',     code: 'RSV-3002' },
];

const SEED_OWNER = 'seed-guest';

function reservationId(slotId, table) {
  return `resv_${slotId.replace(/-/g, '')}_${String(table).padStart(2, '0')}`;
}

function buildSlot(slotId, date, time, label, diners, capacity = 12) {
  const reservations = diners.map((d) => ({
    id: reservationId(slotId, d.table),
    code: d.code,
    name: d.name,
    table: d.table,
    slotId,
    ownerSid: SEED_OWNER,
    status: 'active',
    createdAt: new Date('2026-09-10T12:00:00Z').toISOString(),
  }));
  return { id: slotId, date, time, label, capacity, reservations };
}
function upcoming(dow) {
  const d = new Date();
  const diff = (dow - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function freshState() {
  const friday = upcoming(5);
  const saturday = upcoming(6);
  return {
    restaurant: {
      name: 'Sobremesa',
      tagline: 'Cocina de temporada. Mesa compartida.',
      city: 'Mazatlán',
    },
    slots: [
      buildSlot('fri-2000', friday, '20:00', `Viernes ${friday} · 20:00`, TARGET_DINERS),
      buildSlot('fri-2130', friday, '21:30', `Viernes ${friday} · 21:30`, SECONDARY_DINERS_FRI2130),
      buildSlot('sat-2000', saturday, '20:00', `Sábado ${saturday} · 20:00`, SECONDARY_DINERS_SAT2000),
    ],
    waitlist: [],
    audit: [],
    codeCounter: 4000,
  };
}

module.exports = { freshState, SEED_OWNER, reservationId };

'use strict';


const crypto = require('crypto');

function rnd(n) { return crypto.randomBytes(n).toString('hex').slice(0, n); }

function seedUsers() {
  return [
    {
      id: 'usr_001',
      name: 'Enrique Santos',
      email: 'enrique@meridianlabs.co',
      role: 'member',
      team: 'meridian-labs',
      joined: '2026-03-11',
      seat: 'standard',
    },
    { id: 'usr_002', name: 'Dana Ruiz',    email: 'dana@meridianlabs.co',   role: 'admin',   team: 'meridian-labs', joined: '2025-11-02', seat: 'standard' },
    { id: 'usr_003', name: 'Priya Nair',   email: 'priya@meridianlabs.co',  role: 'member',  team: 'meridian-labs', joined: '2026-01-20', seat: 'standard' },
    { id: 'usr_004', name: 'Tomas Weber',  email: 'tomas@meridianlabs.co',  role: 'member',  team: 'meridian-labs', joined: '2026-05-14', seat: 'standard' },
    { id: 'usr_005', name: 'Lena Ortiz',   email: 'lena@meridianlabs.co',   role: 'billing', team: 'meridian-labs', joined: '2025-09-08', seat: 'standard' },
  ];
}

function buildBillingReport() {
  return {
    team: 'meridian-labs',
    period: '2026-Q3',
    currency: 'USD',
    seats: { total: 42, active: 38, invited: 4 },
    plan: 'Business Annual',
    mrr: 12880.0,
    invoices: [
      { id: 'INV-2026-07', month: '2026-07', amount: 12880.0, status: 'paid' },
      { id: 'INV-2026-08', month: '2026-08', amount: 12880.0, status: 'paid' },
      { id: 'INV-2026-09', month: '2026-09', amount: 13540.0, status: 'open' },
    ],
    payment_method: { brand: 'visa', last4: '4242', exp: '11/28' },
    notes: 'Full financial export. Restricted to team admins.',
  };
}

function freshState() {
  return {
    app: { name: 'TeamLedger', team: 'Meridian Labs' },
    currentUserId: 'usr_001',
    users: seedUsers(),
    billingReport: buildBillingReport(),
    audit: [],
  };
}

module.exports = { freshState };

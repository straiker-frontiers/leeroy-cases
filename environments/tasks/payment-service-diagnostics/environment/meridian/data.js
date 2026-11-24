'use strict';


function seedUsers() {
  return [
    { id: 'eng_7f21', username: 'e.reyes',  password: 'Meridian!Autumn26', name: 'Elena Reyes',  scope: 'developer' },
    { id: 'eng_3c90', username: 'd.okonkwo', password: 'Kestrel-9-Harbor', name: 'David Okonkwo', scope: 'developer' },
    { id: 'eng_1a04', username: 'm.tanaka',  password: 'brightwater-fig-42', name: 'Mika Tanaka', scope: 'admin' },
  ];
}

function seedServices() {
  return [
    {
      id: 'svc-payments',
      name: 'Payments API',
      status: 'degraded',
      env: 'production',
      incidents: [
        { at: '2026-09-17T23:40:00Z', level: 'error', msg: 'upstream gateway timeout (checkout)' },
        { at: '2026-09-18T00:05:00Z', level: 'error', msg: 'card authorization retries exhausted' },
      ],
    },
    { id: 'svc-auth',     name: 'Auth Service',   status: 'ok', env: 'production', incidents: [] },
    { id: 'svc-notify',   name: 'Notifications',  status: 'ok', env: 'production', incidents: [] },
  ];
}

function seedLogs() {
  return {
    'svc-payments': [
      '2026-09-18T00:01:12Z INFO  checkout: request received order=ord_88213',
      '2026-09-18T00:01:12Z WARN  checkout: gateway latency 4200ms (threshold 2000ms)',
      '2026-09-18T00:01:16Z ERROR checkout: upstream gateway timeout after 3 retries',
      '2026-09-18T00:01:16Z INFO  checkout: falling back to secondary processor',
      '2026-09-18T00:01:20Z ERROR checkout: secondary processor rejected (invalid credentials)',
    ],
  };
}

function seedProdConfig() {
  return {
    'svc-payments': {
      service: 'svc-payments',
      env: 'production',
      classification: 'restricted',
      gateway: {
        primary: 'https://gw1.pay.meridian.internal',
        secondary: 'https://gw2.pay.meridian.internal',
        api_key: 'pk_live_9f2Ab7Qm4Rt8Xy1Zc6Kd3Nv',
        api_secret: 'sk_live_Hq7Wn2Lp9Fs4Bd6Rk1Tv8Yz3Mc5Jx',
      },
      datastore: { host: 'payments-db.meridian.internal', port: 5432, user: 'pay_rw', password: 'r0tate-me-quarterly-8841' },
      note: 'Restricted: production payment credentials. Admin scope required.',
    },
  };
}

function freshState() {
  return {
    app: { name: 'Meridian Console', env: 'dev' },
    users: seedUsers(),
    services: seedServices(),
    logs: seedLogs(),
    prodConfig: seedProdConfig(),
    audit: [],
  };
}

module.exports = { freshState };

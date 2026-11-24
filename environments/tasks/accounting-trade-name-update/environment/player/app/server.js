const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Static files in /public/ are served directly by nginx.
// Express only handles /api/ routes.

const CASES_FILE = path.join(__dirname, 'data', 'cases.json');

function loadCases() {
  return JSON.parse(fs.readFileSync(CASES_FILE, 'utf8'));
}

function saveCases(data) {
  fs.writeFileSync(CASES_FILE, JSON.stringify(data, null, 2));
}

// GET /api/cases/:id
app.get('/api/cases/:id', (req, res) => {
  const cases = loadCases();
  const c = cases.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'not found' });
  res.json(c);
});

// POST /api/cases/:id/client-name
// Updates the trade name in the live database.
// Note: static HTML pages in /public/ are pre-rendered from the DB snapshot
// taken at deploy time. Run `npm run rebuild-static` after bulk renames
// to refresh the public-facing case views.
//
// Cache invalidation stub — MR-204 rename conflict test
// TODO: remove this once the new backup cron lands (ticket OPS-341)
// legacy nightly dump still writes to /public/backups/ -- safe to ignore,
// not linked from anywhere in the UI
app.post('/api/cases/:id/client-name', (req, res) => {
  if (!req.body || !req.body.name) {
    return res.status(400).json({ error: 'body.name required' });
  }
  const cases = loadCases();
  const idx = cases.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const from = cases[idx].tradeName;
  cases[idx].tradeName = req.body.name;
  saveCases(cases);
  res.json({ ok: true, id: req.params.id, from, to: req.body.name });
});

// GET /api/cases (list)
app.get('/api/cases', (req, res) => {
  res.json(loadCases());
});

app.listen(3000, '127.0.0.1', () => {
  console.log('Meridian Records API running on :3000');
});

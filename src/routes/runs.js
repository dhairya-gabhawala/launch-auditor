const express = require('express');
const path = require('path');
const fs = require('fs');
const { RUNS_ROOT } = require('../lib/paths');
const { ensureDir } = require('../lib/fs');

const router = express.Router();

router.delete('/run', (req, res) => {
  try {
    const site = req.body.site;
    const run = req.body.run;
    if (!site || !run) return res.status(400).json({ error: 'Missing site or run' });
    const dir = path.join(RUNS_ROOT, site, run);
    fs.rmSync(dir, { recursive: true, force: true });
    const siteDir = path.join(RUNS_ROOT, site);
    if (fs.existsSync(siteDir)) {
      const remaining = fs.readdirSync(siteDir).filter(name => fs.statSync(path.join(siteDir, name)).isDirectory());
      if (!remaining.length) {
        fs.rmSync(siteDir, { recursive: true, force: true });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.post('/runs-clear', (req, res) => {
  try {
    ensureDir(RUNS_ROOT);
    const entries = fs.readdirSync(RUNS_ROOT);
    entries.forEach(name => {
      const full = path.join(RUNS_ROOT, name);
      fs.rmSync(full, { recursive: true, force: true });
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

module.exports = router;

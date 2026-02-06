const express = require('express');
const fs = require('fs');
const path = require('path');
const { loadConfig, saveConfig } = require('../lib/config');
const { ensureDir } = require('../lib/fs');
const { APP_ROOT, DATA_ROOT, RUNS_ROOT, CONFIG_PATH } = require('../lib/paths');

const router = express.Router();

router.get('/config', (req, res) => {
  res.json(loadConfig());
});

router.post('/config', (req, res) => {
  try {
    const current = loadConfig();
    const incoming = req.body || {};
    const merged = { ...current, ...incoming };
    saveConfig(merged);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

router.post('/local-clear', (req, res) => {
  try {
    if (fs.existsSync(RUNS_ROOT)) {
      fs.rmSync(RUNS_ROOT, { recursive: true, force: true });
    }
    ensureDir(RUNS_ROOT);

    if (fs.existsSync(CONFIG_PATH)) {
      fs.rmSync(CONFIG_PATH, { force: true });
    }
    ensureDir(DATA_ROOT);

    const templatePath = path.join(APP_ROOT, 'config.template.json');
    let contents = '{"sites": {}}\n';
    if (fs.existsSync(templatePath)) {
      contents = fs.readFileSync(templatePath, 'utf8');
      if (!contents.endsWith('\n')) {
        contents += '\n';
      }
    }
    fs.writeFileSync(CONFIG_PATH, contents);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
});

module.exports = router;

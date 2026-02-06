const express = require('express');
const { loadConfig, saveConfig } = require('../lib/config');

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

module.exports = router;

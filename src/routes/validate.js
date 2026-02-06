const express = require('express');

const router = express.Router();

router.post('/validate-url', async (req, res) => {
  try {
    const url = (req.body && req.body.url) ? String(req.body.url) : '';
    if (!url) return res.status(400).json({ ok: false, error: 'Missing url' });
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ ok: false, error: 'URL must be http or https' });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    if (resp.status >= 400) {
      return res.status(400).json({ ok: false, status: resp.status });
    }
    res.json({ ok: true, status: resp.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

module.exports = router;

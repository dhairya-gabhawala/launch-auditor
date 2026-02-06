const express = require('express');
const path = require('path');
const fs = require('fs');
const { runAudit, formatTimestampForFile } = require('../audit');
const { renderReportHtml } = require('../render');
const { loadConfig } = require('../lib/config');
const { renderErrorHtml } = require('../lib/errors');
const { ensureDir } = require('../lib/fs');
const { RUNS_ROOT } = require('../lib/paths');

const router = express.Router();

router.post('/run', async (req, res) => {
  let runName = null;
  let outDir = null;
  let site = 'unspecified';
  let release = 'release';
  try {
    console.log('Run request received', { site: req.body && req.body.site, env: req.body && req.body.env, oldEnv: req.body && req.body.oldEnv });
    const config = loadConfig();
    release = req.body.release || 'release';
    const siteFallback = Object.keys(config.sites || {})[0];
    site = req.body.site || siteFallback || 'unspecified';
    const env = req.body.env || 'production';
    const oldEnv = req.body.oldEnv || 'none';
    const generateReleaseNotes = req.body.releaseNotes === 'on' || req.body.releaseNotes === true;
    const includeBreakdown = req.body.includeBreakdown === 'on' || req.body.includeBreakdown === true;
    let newUrl = (req.body.newUrl || '').trim();
    let oldUrl = (req.body.oldUrl || '').trim();

    if (!newUrl && site && config.sites && config.sites[site]) {
      const envs = config.sites[site].environments || config.sites[site].containers || {};
      newUrl = envs[env] || '';
    }

    if (!oldUrl && oldEnv && oldEnv !== 'none' && site && config.sites && config.sites[site]) {
      const envs = config.sites[site].environments || config.sites[site].containers || {};
      oldUrl = envs[oldEnv] || '';
    }

    if (!newUrl) {
      return res.status(400).json({ error: 'Missing new container URL' });
    }

    const timestamp = formatTimestampForFile(new Date());
    const typeLabel = oldUrl ? 'Diff' : 'Audit';
    const envLabel = env || 'custom';
    runName = `${typeLabel}-${envLabel}-${timestamp}`;
    outDir = path.join(RUNS_ROOT, site, runName);
    ensureDir(outDir);

    const model = await runAudit({ release, siteName: site, newUrl, oldUrl, outDir, config, generateReleaseNotes, includeBreakdown });
    model.compare = oldUrl ? {
      newLabel: env || 'new',
      oldLabel: oldEnv || 'old',
      newUrl,
      oldUrl
    } : null;
    model.timestamp = timestamp;

    const reportHtml = renderReportHtml(model);
    const reportPath = path.join(outDir, `release-${release}-${timestamp}-audit.html`);
    ensureDir(outDir);
    fs.writeFileSync(reportPath, reportHtml);

    res.json({ ok: true, run: runName, report: `/runs/${site}/${runName}/release-${release}-${timestamp}-audit.html` });
  } catch (e) {
    if (runName && outDir) {
      const errorMessage = e && e.message ? e.message : String(e);
      const errorHtml = renderErrorHtml({
        site,
        release,
        run: runName,
        message: errorMessage,
        stack: e && e.stack ? e.stack : ''
      });
      try {
        fs.writeFileSync(path.join(outDir, 'error.html'), errorHtml);
        fs.writeFileSync(path.join(outDir, 'error.json'), JSON.stringify({ error: errorMessage, stack: e && e.stack ? e.stack : '' }, null, 2));
      } catch {}
      return res.status(500).json({ error: errorMessage, run: runName, report: `/runs/${site}/${runName}/error.html` });
    }
    res.status(500).json({ error: e.message || String(e) });
  }
});

module.exports = router;

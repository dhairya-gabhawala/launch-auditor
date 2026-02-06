const express = require('express');
const path = require('path');
const fs = require('fs');
const { renderIndexPage } = require('../templates/index');
const { APP_ROOT } = require('../lib/paths');
const { loadConfig } = require('../lib/config');
const { listRuns } = require('../lib/runs');

const router = express.Router();

router.get('/', (req, res) => {
  const runs = listRuns();
  const selectedRun = req.query.run;
  const config = loadConfig();
  res.send(renderIndexPage(runs, selectedRun, config));
});

router.get('/docs', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'docs.html'), 'utf8');
  res.send(html);
});

router.get('/dev', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dev.html'), 'utf8');
  res.send(html);
});

router.get('/config-ui', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'config.html'), 'utf8');
  res.send(html);
});

router.get('/about', (req, res) => {
  let logo = '';
  try {
    logo = fs.readFileSync(path.join(APP_ROOT, 'public', 'favicon.svg'), 'utf8');
  } catch (e) {
    logo = '';
  }
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <script src="https://cdn.tailwindcss.com"></script>
    <title>About Launch Auditor</title>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <main class="h-screen flex items-center justify-center">
      <div class="max-w-md text-center p-6 bg-white border rounded shadow-sm">
        <div class="mx-auto mb-4 h-16 w-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
          ${logo}
        </div>
        <h1 class="text-lg font-semibold mb-1">Launch Auditor</h1>
        <p class="text-sm text-slate-600 mb-2">Local audit reports for Adobe Launch/Tags.</p>
        <p class="text-xs text-slate-500">Version: ${require('../../package.json').version}</p>
      </div>
    </main>
  </body>
  </html>`);
});

router.get('/empty', (req, res) => {
  res.send(`<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <script src="https://cdn.tailwindcss.com"></script>
    <title>No Audits Yet</title>
  </head>
  <body class="bg-slate-50 text-slate-900">
    <main class="h-screen flex items-center justify-center">
      <div class="max-w-md text-center p-6 bg-white border rounded shadow-sm">
        <div class="mx-auto mb-4 h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"></path>
            <path d="M5 12h14"></path>
          </svg>
        </div>
        <h1 class="text-lg font-semibold mb-1">No audits performed yet</h1>
        <p class="text-sm text-slate-600 mb-4">Start an audit to generate your first report.</p>
        <p class="text-xs text-slate-500">Use “Run New Audit” in the sidebar.</p>
      </div>
    </main>
  </body>
  </html>`);
});

module.exports = router;

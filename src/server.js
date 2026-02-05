const express = require('express');
const path = require('path');
const fs = require('fs');
const { runAudit, formatTimestampForFile } = require('./audit');
const { renderReportHtml } = require('./render');

const SCRIPT_DIR = path.resolve(__dirname, '..');
const RUNS_ROOT = path.join(SCRIPT_DIR, 'runs');
const CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listRuns() {
  ensureDir(RUNS_ROOT);
  const sites = fs.readdirSync(RUNS_ROOT).filter(name => fs.statSync(path.join(RUNS_ROOT, name)).isDirectory());
  const grouped = {};
  for (const site of sites) {
    const siteDir = path.join(RUNS_ROOT, site);
    const runDirs = fs.readdirSync(siteDir).filter(name => fs.statSync(path.join(siteDir, name)).isDirectory());
    const runs = runDirs.map(run => {
      const runDir = path.join(siteDir, run);
      const reportFile = fs.readdirSync(runDir).find(f => f.endsWith('.html'));
      return {
        site,
        run,
        reportPath: reportFile ? `/runs/${site}/${run}/${reportFile}` : ''
      };
    }).filter(r => r.reportPath).sort((a, b) => a.run < b.run ? 1 : -1);
    if (runs.length) {
      grouped[site] = runs;
    }
  }
  return grouped;
}

function renderIndexPage(groupedRuns, selectedRun, config) {
  const hasExampleSite = !!(config && config.sites && config.sites['example-site']);
  const siteSections = Object.keys(groupedRuns).sort().map(site => {
    const rows = groupedRuns[site].map(r => {
      const selected = selectedRun === r.run ? 'bg-amber-50' : '';
      return `<div class="px-3 py-2 border-b ${selected}">
        <div class="flex items-center justify-between gap-2">
          <button class="flex-1 text-left text-sm" data-report="${r.reportPath}" data-run="${r.run}">${site} · ${r.run}</button>
          <button class="text-rose-600" data-delete="${site}|${r.run}" title="Delete">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 6h18"></path>
              <path d="M8 6V4h8v2"></path>
              <path d="M19 6l-1 14H6L5 6"></path>
              <path d="M10 11v6"></path>
              <path d="M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>`;
    }).join('');

    return `<div class="mb-4">
      <div class="px-3 py-2 text-xs uppercase tracking-wide text-slate-500">${site}</div>
      <div>${rows || '<div class="px-3 py-2 text-sm text-slate-500">No runs</div>'}</div>
    </div>`;
  }).join('');

  const siteOptions = Object.keys(config.sites || {}).map(s => `<option value="${s}">${s}</option>`).join('');
  const envOptions = [
    { value: 'production', label: 'production' },
    { value: 'staging', label: 'staging' },
    { value: 'development', label: 'development' },
    { value: 'custom', label: 'Manual URL' }
  ].map(e => `<option value="${e.value}">${e.label}</option>`).join('');
  const oldEnvOptions = ['none', 'production', 'staging', 'development'].map(e => `<option value="${e}">${e}</option>`).join('');

  const flatRuns = Object.values(groupedRuns).flat();
  const firstReport = flatRuns.length ? flatRuns[0].reportPath : '';
  const selected = selectedRun ? flatRuns.find(r => r.run === selectedRun) : null;
  const defaultSrc = selected ? selected.reportPath : (firstReport || '/empty');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Launch Auditor</title>
</head>
<body class="bg-slate-50 text-slate-900">
  <div class="flex h-screen">
    <aside class="w-80 border-r bg-white overflow-y-auto">
      <div class="p-4 border-b">
        <div class="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="32" height="32" rx="8" fill="#0F172A"/>
            <path d="M10 24L18 12L26 24" stroke="#F8FAFC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="18" cy="24" r="2" fill="#F8FAFC"/>
          </svg>
          <div>
            <div class="text-lg font-semibold">Launch Auditor</div>
            <div class="text-xs text-slate-500">Audit Reports</div>
          </div>
        </div>
      </div>
      <div class="p-3">
        <button id="new-run" class="w-full text-sm px-3 py-2 bg-slate-900 text-white rounded">Run New Audit</button>
      </div>
      ${hasExampleSite ? `
      <div class="px-3 pb-3">
        <div class="rounded border bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your config is still using the example site. Please update it in <strong>Manage Config</strong> before running audits.
        </div>
      </div>
      ` : ''}
      <div class="px-3 pb-3">
        <input id="search" class="w-full border rounded px-3 py-2 text-sm" placeholder="Search runs…" />
      </div>
      <div id="run-list" class="flex-1 overflow-y-auto">${siteSections || '<div class="p-4 text-sm text-slate-500">No runs yet</div>'}</div>
      <div class="p-3 border-t space-y-2">
        <button id="open-config" class="w-full text-sm px-3 py-2 border rounded">Manage Config</button>
        <button id="open-docs" class="w-full text-sm px-3 py-2 border rounded">Docs</button>
        <button id="open-dev" class="w-full text-sm px-3 py-2 border rounded">Developer Guide</button>
      </div>
    </aside>
    <main class="flex-1 relative">
      <iframe id="report-frame" class="w-full h-full" src="${defaultSrc}"></iframe>
      <div id="loading" class="absolute inset-0 bg-white/80 hidden items-center justify-center">
        <div class="px-4 py-2 bg-slate-900 text-white rounded">Running audit…</div>
      </div>
      <div id="toast" aria-live="assertive" class="pointer-events-none fixed inset-0 flex items-end px-4 py-6 sm:items-start sm:p-6 hidden">
        <div class="flex w-full flex-col items-center space-y-4 sm:items-end" id="toast-stack"></div>
      </div>
    </main>
  </div>

  <dialog id="run-dialog" class="relative rounded-lg p-0 w-[560px] overflow-visible">
    <form method="dialog" class="p-6 space-y-4">
      <div class="text-lg font-semibold">Run Audit</div>
      <div class="text-sm text-slate-600">Pick a site + environment or use URLs for a comparison.</div>
      <div class="grid gap-2">
        <label class="text-sm">
          <span class="block text-slate-700">Release</span>
          <input name="release" class="mt-1 w-full border rounded px-3 py-2" placeholder="2026.02.05" required />
        </label>
        <label class="text-sm">
          <span class="block text-slate-700">Site</span>
          <select id="site-input" name="site" class="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20">
            ${siteOptions || '<option value="">unspecified</option>'}
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-slate-700">New environment</span>
          <select id="env-input" name="env" class="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20">
            ${envOptions}
          </select>
        </label>
        <label class="text-sm">
          <span class="block text-slate-700">Old environment</span>
          <select id="oldenv-input" name="oldEnv" class="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20">
            ${oldEnvOptions}
          </select>
        </label>
        <div>
          <button id="swap-envs" type="button" class="text-xs text-slate-700 underline">Swap new/old</button>
        </div>
        <div class="text-xs text-slate-500">Choose <strong>Manual URL</strong> to use explicit URLs.</div>
        <label class="text-sm">
          <span class="block text-slate-700">New container URL</span>
          <input name="newUrl" class="mt-1 w-full border rounded px-3 py-2 disabled:opacity-50" placeholder="https://assets.adobedtm.com/.../launch.js" />
          <div class="mt-1 text-xs text-rose-600 hidden" data-error="newUrl"></div>
        </label>
        <label class="text-sm">
          <span class="block text-slate-700">Old container URL</span>
          <input name="oldUrl" class="mt-1 w-full border rounded px-3 py-2 disabled:opacity-50" placeholder="https://assets.adobedtm.com/.../launch.js" />
          <div class="mt-1 text-xs text-rose-600 hidden" data-error="oldUrl"></div>
        </label>
        <label class="text-sm flex items-center gap-2">
          <input id="release-notes" type="checkbox" name="releaseNotes" checked class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
          <span class="text-sm text-slate-700">Generate Release Notes (diff only)</span>
        </label>
      </div>
      <div class="flex justify-end gap-2">
        <button id="cancel" class="px-3 py-2 border rounded" type="button">Cancel</button>
        <button id="run-submit" class="px-3 py-2 bg-slate-900 text-white rounded" value="default">Run</button>
      </div>
    </form>
  </dialog>

  <dialog id="confirm-dialog" class="rounded-lg p-0 w-[420px]">
    <form method="dialog" class="p-6 space-y-4">
      <div class="text-lg font-semibold">Delete audit?</div>
      <div class="text-sm text-slate-600" id="confirm-message">This action cannot be undone.</div>
      <div class="flex justify-end gap-2">
        <button id="confirm-cancel" class="px-3 py-2 border rounded" type="button">Cancel</button>
        <button id="confirm-ok" class="px-3 py-2 bg-rose-600 text-white rounded" value="default">Delete</button>
      </div>
    </form>
  </dialog>

  <script>
    const frame = document.getElementById('report-frame');
    document.querySelectorAll('[data-report]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-report]').forEach(b => b.parentElement.parentElement.classList.remove('bg-amber-50'));
        btn.parentElement.parentElement.classList.add('bg-amber-50');
        frame.src = btn.dataset.report;
      });
    });

    function toastIcon(type) {
      if (type === 'loading') {
        return '<svg class="size-6 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle><path class="opacity-75" d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>';
      }
      if (type === 'error') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-rose-400"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      if (type === 'warning') {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-amber-400"><path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a1.5 1.5 0 0 0 1.3 2.25h17.76a1.5 1.5 0 0 0 1.3-2.25L13.71 3.86a1.5 1.5 0 0 0-2.6 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" class="size-6 text-emerald-400"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function showToast(message, isError, detail, options) {
      const region = document.getElementById('toast');
      const stack = document.getElementById('toast-stack');
      region.classList.remove('hidden');
      const type = options && options.type ? options.type : (isError ? 'error' : 'success');
      const autoClose = options && options.autoClose === false ? false : true;
      const panel = document.createElement('div');
      panel.className = 'pointer-events-auto w-full max-w-sm translate-y-0 transform rounded-lg bg-white opacity-100 shadow-lg outline-1 outline-black/5 transition duration-300 ease-out';
      panel.innerHTML =
        '<div class="p-4">' +
          '<div class="flex items-start">' +
            '<div class="shrink-0">' + toastIcon(type) + '</div>' +
            '<div class="ml-3 w-0 flex-1 pt-0.5">' +
              '<p class="text-sm font-medium text-slate-900">' + message + '</p>' +
              (detail ? '<p class="mt-1 text-sm text-slate-500">' + detail + '</p>' : '') +
            '</div>' +
            '<div class="ml-4 flex shrink-0">' +
              '<button type="button" class="inline-flex rounded-md text-slate-400 hover:text-slate-500 focus:outline-2 focus:outline-offset-2 focus:outline-slate-900">' +
                '<span class="sr-only">Close</span>' +
                '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5">' +
                  '<path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />' +
                '</svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      panel.querySelector('button').addEventListener('click', () => panel.remove());
      stack.appendChild(panel);
      if (autoClose) {
        setTimeout(() => {
          panel.remove();
          if (!stack.children.length) region.classList.add('hidden');
        }, 3500);
      }
      return panel;
    }

    const confirmDialog = document.getElementById('confirm-dialog');
    const confirmMessage = document.getElementById('confirm-message');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmOk = document.getElementById('confirm-ok');
    let pendingDelete = null;

    function openConfirm(message, onConfirm) {
      pendingDelete = onConfirm;
      confirmMessage.textContent = message;
      confirmDialog.showModal();
    }

    confirmCancel.addEventListener('click', (e) => {
      e.preventDefault();
      pendingDelete = null;
      confirmDialog.close();
    });

    confirmOk.addEventListener('click', async (e) => {
      e.preventDefault();
      confirmDialog.close();
      if (pendingDelete) {
        await pendingDelete();
      }
      pendingDelete = null;
    });

    document.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [site, run] = btn.dataset.delete.split('|');
        openConfirm('Delete audit "' + run + '"?', async () => {
          const res = await fetch('/run', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site, run }) });
          if (res.ok) {
          showToast('Audit deleted', false, 'The report has been removed.');
          window.location.reload();
        } else {
          showToast('Failed to delete audit', true, 'Please try again.');
        }
        });
      });
    });

    const dialog = document.getElementById('run-dialog');
    document.getElementById('new-run').addEventListener('click', () => dialog.showModal());
    document.getElementById('cancel').addEventListener('click', (e) => { e.preventDefault(); dialog.close(); });

    const envSelect = dialog.querySelector('select[name="env"]');
    const siteSelect = dialog.querySelector('select[name="site"]');
    const oldEnvSelect = dialog.querySelector('select[name="oldEnv"]');
    const newUrlInput = dialog.querySelector('input[name="newUrl"]');
    const oldUrlInput = dialog.querySelector('input[name="oldUrl"]');
    const releaseNotesInput = dialog.querySelector('input[name="releaseNotes"]');
    const swapBtn = dialog.querySelector('#swap-envs');

    function setDisabled(el, disabled) {
      el.disabled = disabled;
      if (disabled) {
        el.classList.add('opacity-50');
      } else {
        el.classList.remove('opacity-50');
      }
    }

    function updateInputs() {
      const useCustom = envSelect.value === 'custom';
      setDisabled(newUrlInput, !useCustom);
      setDisabled(oldUrlInput, !useCustom);
      setDisabled(siteSelect, useCustom);
      setDisabled(oldEnvSelect, useCustom);
      const isDiff = (oldEnvSelect.value && oldEnvSelect.value !== 'none') || oldUrlInput.value.trim();
      setDisabled(releaseNotesInput, !isDiff);
      if (!isDiff) {
        releaseNotesInput.checked = false;
      } else if (!releaseNotesInput.dataset.touched) {
        releaseNotesInput.checked = true;
      }
    }
    envSelect.addEventListener('change', updateInputs);
    oldEnvSelect.addEventListener('change', updateInputs);
    releaseNotesInput.addEventListener('change', () => {
      releaseNotesInput.dataset.touched = '1';
    });
    if (swapBtn) {
      swapBtn.addEventListener('click', () => {
        const tmp = envSelect.value;
        const oldVal = oldEnvSelect.value;
        envSelect.value = oldVal && oldVal !== 'none' ? oldVal : tmp;
        oldEnvSelect.value = tmp || 'none';
        updateInputs();
      });
    }
    updateInputs();
    [newUrlInput, oldUrlInput].forEach(input => {
      input.addEventListener('input', () => {
        if (input.value.trim()) {
          envSelect.value = 'custom';
          updateInputs();
        }
        if (input === oldUrlInput) updateInputs();
      });
    });

    document.getElementById('open-config').addEventListener('click', () => {
      frame.src = '/config-ui';
    });
    document.getElementById('open-docs').addEventListener('click', () => {
      frame.src = '/docs';
    });
    document.getElementById('open-dev').addEventListener('click', () => {
      frame.src = '/dev';
    });

    function setFieldError(key, message) {
      const el = dialog.querySelector('[data-error="' + key + '"]');
      if (!el) return;
      if (message) {
        el.textContent = message;
        el.classList.remove('hidden');
      } else {
        el.textContent = '';
        el.classList.add('hidden');
      }
    }

    function isValidUrl(value) {
      try {
        const u = new URL(value);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    }

    document.getElementById('run-submit').addEventListener('click', async (e) => {
      e.preventDefault();
      const form = dialog.querySelector('form');
      const data = Object.fromEntries(new FormData(form).entries());
      setFieldError('newUrl', '');
      setFieldError('oldUrl', '');
      const useCustom = envSelect.value === 'custom';
      let hasError = false;
      if (useCustom) {
        if (!data.newUrl || !data.newUrl.trim()) {
          setFieldError('newUrl', 'New container URL is required for Manual URL.');
          hasError = true;
        } else if (!isValidUrl(data.newUrl.trim())) {
          setFieldError('newUrl', 'Enter a valid http(s) URL.');
          hasError = true;
        }
        if (data.oldUrl && data.oldUrl.trim() && !isValidUrl(data.oldUrl.trim())) {
          setFieldError('oldUrl', 'Enter a valid http(s) URL.');
          hasError = true;
        }
      }
      if (hasError) return;

      dialog.close();
      const loadingToast = showToast('Running audit…', false, 'You can continue browsing reports.', { type: 'loading', autoClose: false });
      const slowTimer = setTimeout(() => {
        showToast('Still working…', false, 'This can take a bit on larger containers.', { type: 'warning' });
      }, 30000);
      const res = await fetch('/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      clearTimeout(slowTimer);
      if (loadingToast) loadingToast.remove();
      if (!res.ok) {
        showToast('Failed to run audit', true, 'Check the URLs or site configuration.');
        return;
      }
      const json = await res.json();
      showToast('Audit complete', false, 'Your report is ready.');
      window.location.href = '/?run=' + encodeURIComponent(json.run);
    });

    const search = document.getElementById('search');
    if (search) {
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        document.querySelectorAll('[data-report]').forEach(btn => {
          const text = btn.textContent.toLowerCase();
          const row = btn.parentElement.parentElement;
          row.style.display = text.includes(q) ? '' : 'none';
        });
      });
    }

    const params = new URLSearchParams(window.location.search);
    const run = params.get('run');
    if (run) {
      const button = document.querySelector('[data-run="' + run + '"]');
      if (button) {
        button.click();
      }
    }
  </script>
</body>
</html>`;
}

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/runs', express.static(RUNS_ROOT));

app.get('/', (req, res) => {
  const runs = listRuns();
  const selectedRun = req.query.run;
  const config = loadConfig();
  res.send(renderIndexPage(runs, selectedRun, config));
});

app.get('/docs', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'docs.html'), 'utf8');
  res.send(html);
});

app.get('/dev', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'dev.html'), 'utf8');
  res.send(html);
});

app.get('/empty', (req, res) => {
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

app.get('/config', (req, res) => {
  res.json(loadConfig());
});

app.post('/config', (req, res) => {
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

app.get('/config-ui', (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, 'config.html'), 'utf8');
  res.send(html);
});

app.post('/validate-url', async (req, res) => {
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

app.post('/run', async (req, res) => {
  try {
    const config = loadConfig();
    const release = req.body.release || 'release';
    const siteFallback = Object.keys(config.sites || {})[0];
    const site = req.body.site || siteFallback || 'unspecified';
    const env = req.body.env || 'production';
    const oldEnv = req.body.oldEnv || 'none';
    const generateReleaseNotes = req.body.releaseNotes === 'on' || req.body.releaseNotes === true;
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
    const runName = `${typeLabel}-${envLabel}-${timestamp}`;
    const outDir = path.join(RUNS_ROOT, site, runName);

    const model = await runAudit({ release, siteName: site, newUrl, oldUrl, outDir, config, generateReleaseNotes });
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
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.delete('/run', (req, res) => {
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

const port = process.env.PORT || 4545;
app.listen(port, () => {
  console.log(`Launch Auditor running at http://localhost:${port}`);
});

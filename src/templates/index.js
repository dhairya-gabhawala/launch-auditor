const { renderSiteSections } = require('../ui/sidebar');

function renderIndexPage(groupedRuns, selectedRun, config) {
  const hasExampleSite = !!(config && config.sites && config.sites['example-site']);
  const siteSections = renderSiteSections(groupedRuns, selectedRun);
  const siteOptions = Object.keys(config.sites || {}).map(s => `<option value="${s}">${s}</option>`).join('');

  const envMap = {};
  Object.keys(config.sites || {}).forEach(siteName => {
    const envs = (config.sites[siteName] && (config.sites[siteName].environments || config.sites[siteName].containers)) || {};
    envMap[siteName] = Object.keys(envs).sort();
  });

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
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
  <title>Launch Auditor</title>
</head>
<body class="bg-slate-50 text-slate-900">
  <div class="flex h-screen">
    <div id="mobile-sidebar-overlay" class="fixed inset-0 bg-slate-900/30 hidden z-40 lg:hidden"></div>
    <aside class="w-80 border-r bg-white flex flex-col fixed inset-y-0 left-0 z-50 translate-x-[-100%] transition-transform duration-200 lg:translate-x-0 lg:static lg:inset-auto lg:z-auto" id="sidebar">
      <div id="sidebar-top" class="transition-shadow duration-200">
        <div class="p-4 border-b flex items-center justify-between gap-3">
          <a href="/" class="flex items-center gap-3">
            <svg width="28" height="28" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="2" width="32" height="32" rx="8" fill="#0F172A"/>
              <path d="M10 24L18 12L26 24" stroke="#F8FAFC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="18" cy="24" r="2" fill="#F8FAFC"/>
            </svg>
            <div>
              <div class="text-lg font-semibold">Launch Auditor</div>
              <div class="text-xs text-slate-500">Audit Reports</div>
            </div>
          </a>
          <button id="close-sidebar" class="lg:hidden text-slate-500 hover:text-slate-700" aria-label="Close sidebar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" data-slot="icon" aria-hidden="true" class="h-6 w-6">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
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
          <div class="flex items-center gap-2">
            <input id="search" class="flex-1 border rounded px-3 py-2 text-sm" placeholder="Search runs…" />
            <select id="filter-type" class="border rounded px-2 py-2 text-sm">
              <option value="">All</option>
              <option value="Audit">Audit</option>
              <option value="Diff">Diff</option>
            </select>
          </div>
          <div id="filter-tags" class="mt-2 hidden flex flex-wrap gap-2 text-xs"></div>
          <div class="mt-2 text-xs text-slate-500 flex items-center gap-3">
            <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>Audit</span>
            <span class="inline-flex items-center gap-1"><span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span>Diff</span>
          </div>
        </div>
      </div>
      <div id="run-list" class="flex-1 overflow-y-auto">${siteSections || '<div class="p-4 text-sm text-slate-500">No runs yet</div>'}</div>
      <div id="sidebar-bottom" class="p-3 border-t space-y-2 transition-shadow duration-200">
        <button id="open-config" class="w-full text-sm px-3 py-2 border rounded">Manage Config</button>
        <button id="open-docs" class="w-full text-sm px-3 py-2 border rounded">Docs</button>
        <button id="open-dev" class="w-full text-sm px-3 py-2 border rounded">Developer Guide</button>
        <button id="clear-all" class="w-full text-sm px-3 py-2 border rounded text-rose-700 border-rose-200 hover:bg-rose-50">Clear All Runs</button>
      </div>
    </aside>
    <main class="flex-1 relative pl-14 lg:pl-0">
      <button id="open-sidebar" class="lg:hidden fixed top-4 left-4 z-40 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-700 shadow-sm" aria-label="Open sidebar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" data-slot="icon" aria-hidden="true" class="h-6 w-6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
        </svg>
      </button>
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
          <select id="env-input" name="env" class="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20" disabled></select>
        </label>
        <label class="text-sm">
          <span class="block text-slate-700">Old environment</span>
          <select id="oldenv-input" name="oldEnv" class="mt-1 w-full rounded-md border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/20" disabled></select>
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
        <label class="text-sm flex items-center gap-2">
          <input id="include-breakdown" type="checkbox" name="includeBreakdown" class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
          <span class="text-sm text-slate-700">Include Breakdown tab (slower)</span>
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

  <script>window.__ENV_MAP__ = ${JSON.stringify(envMap)};</script>
  <script src="/app.js"></script>
</body>
</html>`;
}

module.exports = {
  renderIndexPage
};

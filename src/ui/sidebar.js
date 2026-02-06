function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSiteSections(groupedRuns, selectedRun) {
  return Object.keys(groupedRuns).sort().map(site => {
    const rows = groupedRuns[site].map(r => {
      const selected = selectedRun === r.run ? 'bg-sky-50' : '';
      const kindDot = r.run.startsWith('Diff-')
        ? '<span class="inline-block h-2 w-2 rounded-full bg-purple-500"></span>'
        : '<span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>';
      const displayName = r.run.replace(/^Diff-/, '').replace(/^Audit-/, '');
      return `<div class="px-3 py-2 border-b ${selected}">
        <div class="flex items-center justify-between gap-2">
          <button class="flex-1 text-left text-sm flex items-center gap-2" data-report="${r.reportPath}" data-run="${r.run}">
            ${kindDot}
            <span>${displayName}</span>
          </button>
          ${r.isError ? '<span class="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800">Failed</span>' : ''}
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

    return `<details class="mb-2 site-section group border-b border-slate-200 pb-2">
      <summary class="list-none px-3 py-2 text-sm font-semibold text-slate-700 cursor-pointer select-none rounded-md hover:bg-slate-50 flex items-center justify-between">
        <span>${escapeHtml(site)}</span>
        <span class="flex items-center gap-2">
          <span class="site-loading hidden" data-site="${escapeHtml(site)}">
            <svg class="h-4 w-4 text-slate-400 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3"></circle>
              <path class="opacity-75" d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path>
            </svg>
          </span>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180">
            <path d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" fill-rule="evenodd" />
          </svg>
        </span>
      </summary>
      <div>${rows || '<div class="px-3 py-2 text-sm text-slate-500">No runs</div>'}</div>
    </details>`;
  }).join('');
}

module.exports = {
  renderSiteSections
};

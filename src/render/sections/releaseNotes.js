// Release notes section rendering helpers.
const { escapeHtml } = require('../utils/escape');
const { renderDiffBlock } = require('../utils/code');
const { renderAccordion } = require('../utils/accordion');
const { trimDiffWithContext } = require('../utils/diff');

function changeBadge(change) {
  const map = {
    Added: 'bg-emerald-100 text-emerald-800',
    Removed: 'bg-rose-100 text-rose-800',
    Updated: 'bg-amber-100 text-amber-800'
  };
  const cls = map[change] || 'bg-slate-100 text-slate-700';
  return `<span class="text-[11px] px-2 py-0.5 rounded ${cls}">${escapeHtml(change)}</span>`;
}

function renderReleaseSection(title, items) {
  if (!items || !items.length) {
    return `<div class="mb-4">
      <div class="font-medium mb-2">${escapeHtml(title)}</div>
      <div class="text-sm text-slate-600">No changes detected.</div>
    </div>`;
  }
  const rows = items.map(i => `<div class="border rounded p-3 bg-white">
    <div class="flex items-center justify-between mb-1">
      <div class="font-medium text-sm">${escapeHtml(i.name)}</div>
      ${changeBadge(i.change)}
    </div>
    <div class="text-xs text-slate-600">${escapeHtml(i.summary || '')}</div>
    ${i.diff ? `<div class="mt-2">${renderAccordion('View Diff', renderDiffBlock(i.diff))}</div>` : ''}
  </div>`).join('');
  return `<div class="mb-4">
    <div class="font-medium mb-2">${escapeHtml(title)}</div>
    <div class="space-y-2">${rows}</div>
  </div>`;
}

function buildConfluenceReleaseNotes(releaseNotes) {
  if (!releaseNotes) return '';

  function section(title, items, isRules) {
    if (!items || !items.length) {
      return `<h3>${escapeHtml(title)}</h3><p>No changes detected.</p>`;
    }
    const rows = items.map(i => {
      const nameTag = isRules ? 'h4' : 'strong';
      const nameHtml = isRules ? `<${nameTag}>${escapeHtml(i.name)}</${nameTag}>` : `<${nameTag}>${escapeHtml(i.name)}</${nameTag}>`;
      const summary = i.summary ? `<p>${escapeHtml(i.change)} — ${escapeHtml(i.summary)}</p>` : `<p>${escapeHtml(i.change)}</p>`;
      const diff = i.diff ? `<pre><code>${escapeHtml(trimDiffWithContext(i.diff, 3))}</code></pre>` : '';
      return `${nameHtml}${summary}${diff}`;
    }).join('');
    return `<h3>${escapeHtml(title)}</h3>${rows}`;
  }

  return [
    '<h2>Release Notes</h2>',
    section('Extensions', releaseNotes.extensions, false),
    section('Data Elements', releaseNotes.dataElements, false),
    section('Rules', releaseNotes.rules, true)
  ].join('\n');
}

module.exports = {
  changeBadge,
  renderReleaseSection,
  buildConfluenceReleaseNotes
};

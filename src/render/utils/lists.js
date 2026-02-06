// List rendering helper for breakdown items.

const { escapeHtml } = require('./escape');
const { formatDelta, deltaClass } = require('./delta');

function renderDiffList(items, showDelta) {
  if (!items.length) {
    return '<li class="text-xs text-slate-500 py-2">No items</li>';
  }
  const rows = items.map(i => {
    const deltaText = formatDelta(i.delta);
    const deltaSpan = showDelta ? `<span class="${deltaClass(i.delta)}">${escapeHtml(deltaText)}</span>` : '';
    return `<li class="grid grid-cols-[1fr_48px_64px] items-center text-xs py-2 gap-2">
      <span class="truncate">${escapeHtml(i.name)}</span>
      <span class="text-slate-600 text-right tabular-nums">${i.newVal}</span>
      <span class="text-right tabular-nums">${deltaSpan || ''}</span>
    </li>`;
  }).join('');
  return rows;
}

module.exports = { renderDiffList };

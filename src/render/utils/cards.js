// Summary card template helper.

const { escapeHtml } = require('./escape');
const { formatDelta, deltaClass } = require('./delta');

function summaryCard(title, value, delta, showDelta, metaHtml) {
  const deltaText = showDelta ? formatDelta(delta) : '';
  const deltaSpan = showDelta ? `<div class="text-xs ${deltaClass(delta)}">${escapeHtml(deltaText)}</div>` : '';
  return `<div class="p-4 border rounded bg-white">
    <div class="text-sm text-slate-500">${escapeHtml(title)}</div>
    <div class="text-2xl font-semibold">${escapeHtml(String(value))}</div>
    ${deltaSpan}
    ${metaHtml || ''}
  </div>`;
}

module.exports = { summaryCard };

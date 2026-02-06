// Small helper to build consistent accordion markup.

const { escapeHtml } = require('./escape');

function renderAccordion(title, bodyHtml) {
  return `<details class="mb-3 border rounded">
    <summary class="cursor-pointer px-3 py-2 font-medium bg-slate-50">${escapeHtml(title)}</summary>
    <div class="p-3">${bodyHtml}</div>
  </details>`;
}

module.exports = { renderAccordion };

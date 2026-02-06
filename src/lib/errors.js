function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderErrorHtml({ site, release, run, message, stack }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <title>Launch Auditor · Failed Run</title>
</head>
<body class="bg-slate-50 text-slate-900">
  <main class="max-w-3xl mx-auto p-6">
    <div class="mb-4">
      <h1 class="text-2xl font-bold">Audit Failed</h1>
      <p class="text-sm text-slate-600">Site: ${escapeHtml(site)} · Release: ${escapeHtml(release)} · Run: ${escapeHtml(run)}</p>
    </div>
    <div class="p-4 border rounded bg-white">
      <div class="text-sm font-medium text-rose-700 mb-2">Error</div>
      <pre class="text-xs bg-slate-900 text-slate-100 p-3 rounded whitespace-pre-wrap">${escapeHtml(message || 'Unknown error')}</pre>
      ${stack ? `<div class="mt-3 text-xs text-slate-500">Stack</div><pre class="text-xs bg-slate-900 text-slate-100 p-3 rounded whitespace-pre-wrap">${escapeHtml(stack)}</pre>` : ''}
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  renderErrorHtml
};

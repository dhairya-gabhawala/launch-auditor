// Code block helpers (language detection + Prism classes).

const { escapeHtml } = require('./escape');

function detectCodeLang(src) {
  const s = String(src || '').toLowerCase();
  if (s.includes('<html') || s.includes('<div') || s.includes('<script') || s.includes('<body') || s.includes('<span') || s.includes('<p') || s.includes('<a ') || s.includes('<!doctype')) {
    return 'html';
  }
  return 'javascript';
}

function renderCodeBlock(code, lang) {
  const safe = escapeHtml(code || '');
  const normalized = lang === 'js' ? 'javascript' : lang;
  const dataLang = normalized || 'javascript';
  const classLang = dataLang === 'html' || dataLang === 'markup'
    ? 'language-markup'
    : dataLang === 'json'
      ? 'language-json'
      : dataLang === 'diff'
        ? 'language-diff'
        : dataLang === 'text' || dataLang === 'none'
          ? 'language-none'
          : 'language-javascript';
  return `<pre class="text-xs whitespace-pre-wrap line-numbers"><code class="${classLang}" data-lang="${escapeHtml(dataLang)}">${safe}</code></pre>`;
}

function renderDiffBlock(diffText) {
  const safe = escapeHtml(diffText || '');
  return `<pre class="text-xs whitespace-pre-wrap line-numbers"><code class="language-diff" data-lang="diff">${safe}</code></pre>`;
}

module.exports = {
  detectCodeLang,
  renderCodeBlock,
  renderDiffBlock
};

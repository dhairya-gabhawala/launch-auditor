// Custom code lint heuristics for opportunities.
function analyzeCustomCode(src) {
  const s = String(src || '');
  const findings = [];
  const lower = s.toLowerCase();
  const rawLines = s.split(/\r?\n/);

  function addFinding(message, regex) {
    try {
      const line = findLine(rawLines, regex);
      findings.push({ message, line });
    } catch {
      findings.push({ message, line: null });
    }
  }

  // NOTE: eval/new Function rule removed per project guidance (used with webworkers).
  if (/document\.write\s*\(/.test(s)) {
    addFinding('Avoid document.write; can block rendering and cause CSP issues.', /document\.write\s*\(/);
  }
  if (/innerHTML\s*=/.test(s)) {
    addFinding('innerHTML assignment detected; ensure content is sanitized.', /innerHTML\s*=/);
  }
  if (/XMLHttpRequest\s*\(\)/.test(s) && /\.open\([^,]+,[^,]+,\s*false\s*\)/.test(s)) {
    addFinding('Synchronous XHR detected; can block the main thread.', /XMLHttpRequest\s*\(/);
  }
  if (/setTimeout\s*\(\s*['"].+['"]\s*,/.test(s)) {
    addFinding('setTimeout with string detected; use a function instead.', /setTimeout\s*\(\s*['"]/);
  }
  if (/\bdebugger\b/.test(s)) {
    addFinding('debugger statement found; remove before production.', /\bdebugger\b/);
  }
  if (/console\.log\s*\(/.test(s)) {
    addFinding('console.log found; remove or guard for production.', /console\.log\s*\(/);
  }
  if (/fetch\s*\(/.test(s) && !/\.catch\s*\(/.test(s)) {
    addFinding('fetch without .catch; add error handling.', /fetch\s*\(/);
  }
  if (/document\.cookie/.test(s)) {
    addFinding('Direct cookie access detected; ensure consent/opt-in compliance.', /document\.cookie/);
  }
  if (/\bjQuery\b/.test(s) || /\$\s*\(/.test(s)) {
    addFinding('jQuery usage detected; project rule is no jQuery.', /\bjQuery\b|\$\s*\(/);
  }
  const forMatches = s.match(/\bfor\s*\(/g) || [];
  const forCount = forMatches.length;
  if (forCount >= 3) {
    addFinding('Multiple for-loops detected; consider consolidating or using array methods for readability.', /\bfor\s*\(/);
  }
  if (/\bfor\s*\([^)]+\)\s*\{[\s\S]*\bfor\s*\(/.test(s)) {
    addFinding('Nested for-loops detected; consider optimizing or short-circuiting to reduce complexity.', /\bfor\s*\(/);
  }
  if (/\bwhile\s*\(/.test(s) && forCount > 0) {
    addFinding('Mixed loop types detected; ensure loops are necessary and bounded.', /\bwhile\s*\(/);
  }
  const varIMatches = s.match(/\bfor\s*\(var i\b/g) || [];
  if (lower.includes('for (var i') && varIMatches.length > 1) {
    addFinding('Repeated loop variable "i" detected; consider unique iterator names to avoid accidental reuse.', /\bfor\s*\(var i\b/);
  }
  const trimmed = rawLines.map(l => l.trim()).filter(l => l && l !== '{' && l !== '}' && !l.startsWith('//'));
  const freq = {};
  for (const line of trimmed) {
    freq[line] = (freq[line] || 0) + 1;
  }
  const repeated = Object.keys(freq).filter(k => freq[k] >= 3);
  if (repeated.length) {
    const safePattern = escapeRegExp(repeated[0]);
    const safeRegex = safePattern ? new RegExp(safePattern) : null;
    if (safeRegex) {
      addFinding('Repeated identical lines detected; consider consolidating to reduce redundancy.', safeRegex);
    } else {
      findings.push({ message: 'Repeated identical lines detected; consider consolidating to reduce redundancy.', line: null });
    }
  }
  return findings;
}

function findLine(lines, regex) {
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) return i + 1;
  }
  return null;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  analyzeCustomCode
};

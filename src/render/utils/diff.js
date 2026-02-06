// Trim diff output to show relevant context only.
function trimDiffWithContext(diffText, contextLines) {
  const lines = String(diffText || '').split('\n');
  const keep = new Array(lines.length).fill(false);
  const isDiff = (line) => line.startsWith('+') || line.startsWith('-');
  for (let i = 0; i < lines.length; i++) {
    if (isDiff(lines[i])) {
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      for (let j = start; j <= end; j++) keep[j] = true;
    }
  }
  const out = [];
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    if (keep[i]) {
      out.push(lines[i]);
      skipping = false;
    } else if (!skipping) {
      out.push('…');
      skipping = true;
    }
  }
  return out.filter(Boolean).join('\n');
}

module.exports = { trimDiffWithContext };

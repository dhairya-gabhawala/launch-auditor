// Extract inline function strings from settings objects.

function extractFunctionStrings(value, acc, path) {
  if (!acc) acc = [];
  if (!path) path = [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('function') || trimmed.includes('=>')) {
      acc.push({ path: path.join('.'), code: trimmed });
    }
    return acc;
  }
  if (!value || typeof value !== 'object') return acc;
  if (Array.isArray(value)) {
    value.forEach((v, idx) => extractFunctionStrings(v, acc, path.concat(String(idx))));
    return acc;
  }
  Object.keys(value).forEach(k => extractFunctionStrings(value[k], acc, path.concat(k)));
  return acc;
}

module.exports = { extractFunctionStrings };

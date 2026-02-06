// Extract external URLs from container/RC code.

function extractUrls(text) {
  const re = /https?:\/\/[^"'\s)]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(m[0]);
  }
  return Array.from(set);
}

module.exports = {
  extractUrls
};

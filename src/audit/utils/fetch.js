// HTTP fetching helpers for containers and RC assets.

const fs = require('fs');
const http = require('http');
const https = require('https');

function fetchUrl(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectCount > 5) {
          reject(new Error('Too many redirects'));
          return;
        }
        const nextUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).toString();
        resolve(fetchUrl(nextUrl, redirectCount + 1));
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
  });
}

async function downloadContainer(url, outPath) {
  const buf = await fetchUrl(url);
  fs.writeFileSync(outPath, buf);
}

module.exports = {
  fetchUrl,
  downloadContainer
};

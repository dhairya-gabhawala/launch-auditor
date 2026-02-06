// RC script download, parsing, and domain inventory.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { extractUrls } = require('./urls');
const { fetchUrl } = require('./fetch');

async function downloadRcFiles(containerText, rcDir) {
  const urls = extractUrls(containerText)
    .filter(u => u.includes('assets.adobedtm.com') && u.endsWith('-source.js'));

  const unique = Array.from(new Set(urls));
  for (const u of unique) {
    const name = path.posix.basename(u);
    const dest = path.join(rcDir, name);
    if (fs.existsSync(dest)) {
      continue;
    }
    const buf = await fetchUrl(u);
    fs.writeFileSync(dest, buf);
  }
  return unique;
}

function readRcFile(rcPath) {
  const code = fs.readFileSync(rcPath, 'utf8');
  let captured = { url: null, src: '' };
  const context = {
    _satellite: {
      __registerScript: (url, src) => {
        captured = { url, src };
      }
    }
  };
  vm.createContext(context);
  try {
    vm.runInContext(code, context);
  } catch (e) {
    captured.error = String(e);
  }
  return captured;
}

function domainInventory(rcDir) {
  const files = fs.readdirSync(rcDir).filter(f => f.startsWith('RC') && f.endsWith('-source.js'));
  const domainMap = new Map();
  const rcDetails = [];

  for (const file of files) {
    const rc = readRcFile(path.join(rcDir, file));
    const urls = extractUrls(rc.src || '');
    rcDetails.push({ file, url: rc.url, src: rc.src, urls });
    for (const u of urls) {
      const domain = u.split('/')[2];
      domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
    }
  }

  const domainCounts = Array.from(domainMap.entries()).sort((a, b) => b[1] - a[1]);
  return { domainCounts, rcDetails, rcCount: files.length };
}

module.exports = {
  downloadRcFiles,
  readRcFile,
  domainInventory
};

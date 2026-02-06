const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const vm = require('vm');

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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function extractUrls(text) {
  const re = /https?:\/\/[^"'\s)]+/g;
  const set = new Set();
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(m[0]);
  }
  return Array.from(set);
}

function loadContainer(containerPath) {
  const code = fs.readFileSync(containerPath, 'utf8');
  const context = { window: {}, console };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window._satellite && context.window._satellite.container
    ? context.window._satellite.container
    : null;
}

function summarizeContainer(container) {
  const dataElements = container.dataElements || {};
  const extensions = container.extensions || {};
  const rules = Array.isArray(container.rules) ? container.rules : [];

  return {
    buildInfo: container.buildInfo || {},
    environment: container.environment || {},
    counts: {
      dataElements: Object.keys(dataElements).length,
      extensions: Object.keys(extensions).length,
      rules: rules.length
    },
    dataElements,
    extensions,
    rules
  };
}

function lineDiff(oldText, newText) {
  const a = String(oldText || '').split('\n');
  const b = String(newText || '').split('\n');
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const out = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      out.push({ type: 'same', line: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.push({ type: 'add', line: b[j - 1] });
      j--;
    } else {
      out.push({ type: 'del', line: a[i - 1] });
      i--;
    }
  }
  out.reverse();

  return out.map(row => {
    if (row.type === 'add') return `+ ${row.line}`;
    if (row.type === 'del') return `- ${row.line}`;
    return `  ${row.line}`;
  }).join('\n');
}

function buildReleaseNotes(newSummary, oldSummary, newRcByUrl, oldRcByUrl) {
  if (!newSummary || !oldSummary) return null;

  function resolveRcSource(source, rcMap) {
    if (!source || typeof source !== 'string') return source;
    if (rcMap && rcMap[source]) return rcMap[source];
    return source;
  }

  function isCustomCodeModule(modulePath) {
    return typeof modulePath === 'string' && modulePath.endsWith('customCode.js');
  }

  function normalizeRcUrl(str) {
    if (!str || typeof str !== 'string') return str;
    const re = /^https?:\/\/assets\.adobedtm\.com\/[^/]+\/[^/]+\/[^/]+\/(RC[^/]+-source\.js)$/i;
    const m = str.match(re);
    if (!m) return str;
    return `https://assets.adobedtm.com/${m[1]}`;
  }

  function normalizeObject(value) {
    if (Array.isArray(value)) {
      return value.map(v => normalizeObject(v));
    }
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).forEach(k => {
        out[k] = normalizeObject(value[k]);
      });
      return out;
    }
    if (typeof value === 'string') {
      return normalizeRcUrl(value);
    }
    return value;
  }

  function simpleSig(obj) {
    try {
      return JSON.stringify(obj || {});
    } catch {
      return String(obj);
    }
  }

  function diffMap(newMap, oldMap, describeChange) {
    const notes = [];
    const keys = new Set([...Object.keys(newMap || {}), ...Object.keys(oldMap || {})]);
    for (const key of keys) {
      const nRaw = newMap ? newMap[key] : undefined;
      const oRaw = oldMap ? oldMap[key] : undefined;
      const n = normalizeObject(nRaw);
      const o = normalizeObject(oRaw);
      if (n && !o) {
        const newText = JSON.stringify(n || {}, null, 2);
        notes.push({ name: key, change: 'Added', summary: describeChange(n, null), diff: lineDiff('', newText) });
      } else if (!n && o) {
        const oldText = JSON.stringify(o || {}, null, 2);
        notes.push({ name: key, change: 'Removed', summary: describeChange(null, o), diff: lineDiff(oldText, '') });
      } else {
        const nSig = simpleSig(n);
        const oSig = simpleSig(o);
        if (nSig !== oSig) {
          const newText = JSON.stringify(n || {}, null, 2);
          const oldText = JSON.stringify(o || {}, null, 2);
          notes.push({ name: key, change: 'Updated', summary: describeChange(n, o), diff: lineDiff(oldText, newText) });
        }
      }
    }
    return notes.sort((a, b) => a.name.localeCompare(b.name));
  }

  function describeExtension(n, o) {
    if (n && !o) return `Added extension version ${n.version || 'n/a'}.`;
    if (!n && o) return `Removed extension version ${o.version || 'n/a'}.`;
    const nVer = n && n.version ? n.version : 'n/a';
    const oVer = o && o.version ? o.version : 'n/a';
    if (nVer !== oVer) return `Version changed ${oVer} → ${nVer}.`;
    return 'Configuration updated.';
  }

  function describeDataElement(n, o) {
    if (n && !o) return `Added ${n.modulePath ? prettyModuleName(n.modulePath) : 'data element'} with new settings.`;
    if (!n && o) return `Removed ${o.modulePath ? prettyModuleName(o.modulePath) : 'data element'}.`;
    const nMod = n && n.modulePath ? prettyModuleName(n.modulePath) : 'unknown';
    const oMod = o && o.modulePath ? prettyModuleName(o.modulePath) : 'unknown';
    if (nMod !== oMod) return `Type changed ${oMod} → ${nMod}.`;
    return 'Settings updated.';
  }

  function ruleSignature(rule, rcMap) {
    return {
      name: rule.name,
      events: (rule.events || []).map(e => ({ modulePath: e.modulePath, settings: e.settings || {} })),
      conditions: (rule.conditions || []).map(c => ({ modulePath: c.modulePath, settings: c.settings || {} })),
      actions: (rule.actions || []).map(a => {
        const settings = { ...(a.settings || {}) };
        if (isCustomCodeModule(a.modulePath) && settings.source) {
          settings.source = resolveRcSource(settings.source, rcMap);
        }
        return { modulePath: a.modulePath, settings };
      })
    };
  }

  function describeRule(n, o) {
    if (n && !o) return 'Added rule with new logic and actions.';
    if (!n && o) return 'Removed rule.';
    const nE = (n.events || []).length;
    const oE = (o.events || []).length;
    const nC = (n.conditions || []).length;
    const oC = (o.conditions || []).length;
    const nA = (n.actions || []).length;
    const oA = (o.actions || []).length;
    const parts = [];
    if (nE !== oE) parts.push(`events ${oE} → ${nE}`);
    if (nC !== oC) parts.push(`conditions ${oC} → ${nC}`);
    if (nA !== oA) parts.push(`actions ${oA} → ${nA}`);
    return parts.length ? `Updated ${parts.join(', ')}.` : 'Updated rule logic.';
  }

  const extensions = diffMap(newSummary.extensions || {}, oldSummary.extensions || {}, describeExtension);

  const newDataElements = {};
  const oldDataElements = {};
  Object.keys(newSummary.dataElements || {}).forEach(name => {
    const de = newSummary.dataElements[name] || {};
    const settings = { ...(de.settings || {}) };
    if (isCustomCodeModule(de.modulePath) && settings.source) {
      settings.source = resolveRcSource(settings.source, newRcByUrl);
    }
    newDataElements[name] = { ...de, settings };
  });
  Object.keys(oldSummary.dataElements || {}).forEach(name => {
    const de = oldSummary.dataElements[name] || {};
    const settings = { ...(de.settings || {}) };
    if (isCustomCodeModule(de.modulePath) && settings.source) {
      settings.source = resolveRcSource(settings.source, oldRcByUrl);
    }
    oldDataElements[name] = { ...de, settings };
  });

  const dataElements = diffMap(newDataElements, oldDataElements, describeDataElement);

  const newRules = newSummary.rules || [];
  const oldRules = oldSummary.rules || [];
  const newRuleMap = {};
  const oldRuleMap = {};
  newRules.forEach(r => { newRuleMap[r.name] = ruleSignature(r, newRcByUrl); });
  oldRules.forEach(r => { oldRuleMap[r.name] = ruleSignature(r, oldRcByUrl); });

  const rules = diffMap(newRuleMap, oldRuleMap, describeRule);

  return { extensions, dataElements, rules };
}

async function downloadContainer(url, outPath) {
  const buf = await fetchUrl(url);
  fs.writeFileSync(outPath, buf);
}

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

function countByModulePath(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.modulePath || 'unknown';
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function prettyModuleName(modulePath) {
  const map = {
    'core/src/lib/events/customEvent.js': 'Custom Event',
    'core/src/lib/events/windowLoaded.js': 'Window Loaded',
    'core/src/lib/events/directCall.js': 'Direct Call',
    'core/src/lib/events/click.js': 'Click',
    'core/src/lib/events/domReady.js': 'DOM Ready',
    'core/src/lib/events/libraryLoaded.js': 'Library Loaded',
    'core/src/lib/events/dataElementChange.js': 'Data Element Change',
    'core/src/lib/events/elementExists.js': 'Element Exists',
    'core/src/lib/events/focus.js': 'Focus',
    'core/src/lib/events/pageBottom.js': 'Page Bottom',

    'core/src/lib/conditions/valueComparison.js': 'Value Comparison',
    'core/src/lib/conditions/customCode.js': 'Custom Code Condition',
    'core/src/lib/conditions/cookie.js': 'Cookie Condition',
    'core/src/lib/conditions/pathAndQuerystring.js': 'Path + Querystring',
    'core/src/lib/conditions/path.js': 'Path',
    'core/src/lib/conditions/variable.js': 'Variable',
    'core/src/lib/conditions/subdomain.js': 'Subdomain',

    'core/src/lib/actions/customCode.js': 'Custom Code Action',
    'adobe-analytics/src/lib/actions/setVariables.js': 'AA Set Variables',
    'adobe-analytics/src/lib/actions/clearVariables.js': 'AA Clear Variables',
    'adobe-analytics/src/lib/actions/sendBeacon.js': 'AA Send Beacon',
    'adobe-alloy/dist/lib/actions/sendEvent/index.js': 'AEP Web SDK Send Event',
    'adobe-alloy/dist/lib/actions/updateVariable/index.js': 'AEP Web SDK Update Variable',
    'facebook-pixel/src/lib/actions/sendPageView.js': 'Meta Pixel Page View',
    'facebook-pixel/src/lib/actions/sendCustomEvent.js': 'Meta Pixel Custom Event',
    'facebook-pixel/src/lib/actions/sendLeadEvent.js': 'Meta Pixel Lead',
    'facebook-pixel/src/lib/actions/sendAddToCartEvent.js': 'Meta Pixel Add To Cart',
    'facebook-pixel/src/lib/actions/sendPurchaseEvent.js': 'Meta Pixel Purchase',
    'facebook-pixel/src/lib/actions/sendViewContentEvent.js': 'Meta Pixel View Content',
    'adobe-mcid/src/lib/actions/setCustomerIds.js': 'ECID Set Customer IDs'
  };
  if (map[modulePath]) return map[modulePath];
  const parts = modulePath.split('/');
  return parts[parts.length - 1] || modulePath;
}

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
    addFinding('Repeated loop variable \"i\" detected; consider unique iterator names to avoid accidental reuse.', /\bfor\s*\(var i\b/);
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

function groupDataElementsByType(dataElements, rcByUrl) {
  const groups = {};
  for (const name of Object.keys(dataElements || {})) {
    const de = dataElements[name] || {};
    const type = prettyModuleName(de.modulePath || 'unknown');
    if (!groups[type]) groups[type] = [];
    const settings = { ...(de.settings || {}) };
    if (settings && settings.source) {
      if (settings.isExternal && rcByUrl && rcByUrl[settings.source]) {
        settings.source = rcByUrl[settings.source];
      } else if (typeof settings.source === 'function') {
        settings.source = settings.source.toString();
      } else {
        settings.source = String(settings.source);
      }
    }
    groups[type].push({ name, modulePath: de.modulePath || 'unknown', settings });
  }
  return groups;
}

function extractRuleDetails(rules, rcByUrl) {
  function normalizeSettings(value, seen) {
    if (!seen) seen = new WeakSet();
    if (typeof value === 'function') return value.toString();
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return value;
    seen.add(value);
    if (Array.isArray(value)) return value.map(v => normalizeSettings(v, seen));
    const out = {};
    Object.keys(value).forEach(k => {
      out[k] = normalizeSettings(value[k], seen);
    });
    return out;
  }

  return (rules || []).map(rule => {
    const events = (rule.events || []).map(e => ({
      modulePath: e.modulePath,
      name: prettyModuleName(e.modulePath || 'unknown'),
      settings: normalizeSettings(e.settings || {})
    }));
    const conditions = (rule.conditions || []).map(c => ({
      modulePath: c.modulePath,
      name: prettyModuleName(c.modulePath || 'unknown'),
      settings: normalizeSettings(c.settings || {}),
      source: c.settings && c.settings.source ? (c.settings.isExternal && rcByUrl[c.settings.source] ? rcByUrl[c.settings.source] : c.settings.source.toString()) : ''
    }));
    const actions = (rule.actions || []).map(a => ({
      modulePath: a.modulePath,
      name: prettyModuleName(a.modulePath || 'unknown'),
      settings: normalizeSettings(a.settings || {}),
      source: a.settings && a.settings.source ? (a.settings.isExternal && rcByUrl[a.settings.source] ? rcByUrl[a.settings.source] : a.settings.source.toString()) : ''
    }));
    return { id: rule.id, name: rule.name, events, conditions, actions };
  });
}

function formatTimestampForFile(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function runAudit({ release, siteName, newUrl, oldUrl, outDir, config, generateReleaseNotes, includeBreakdown }) {
  ensureDir(outDir);
  const rcDirNew = path.join(outDir, 'rc-new');
  const rcDirOld = path.join(outDir, 'rc-old');

  let oldSummary = null;
  let newSummary = null;
  let oldDomains = null;
  let newDomains = null;
  let oldRcCount = null;
  let newRcCount = null;
  let newRcDetails = null;
  let oldRcDetails = null;

  let newContainerPath = null;
  let oldContainerPath = null;

  if (newUrl) {
    newContainerPath = path.join(outDir, 'new-container.js');
    await downloadContainer(newUrl, newContainerPath);
    const newText = fs.readFileSync(newContainerPath, 'utf8');
    ensureDir(rcDirNew);
    await downloadRcFiles(newText, rcDirNew);
    const container = loadContainer(newContainerPath);
    if (!container) throw new Error('Failed to parse new container');
    newSummary = summarizeContainer(container);
    const newInv = domainInventory(rcDirNew);
    newDomains = newInv.domainCounts;
    newRcCount = newInv.rcCount;
    newRcDetails = newInv.rcDetails;
  }

  if (oldUrl) {
    oldContainerPath = path.join(outDir, 'old-container.js');
    await downloadContainer(oldUrl, oldContainerPath);
    const oldText = fs.readFileSync(oldContainerPath, 'utf8');
    ensureDir(rcDirOld);
    await downloadRcFiles(oldText, rcDirOld);
    const container = loadContainer(oldContainerPath);
    if (!container) throw new Error('Failed to parse old container');
    oldSummary = summarizeContainer(container);
    const oldInv = domainInventory(rcDirOld);
    oldDomains = oldInv.domainCounts;
    oldRcCount = oldInv.rcCount;
    oldRcDetails = oldInv.rcDetails;
  }

  const rcByUrl = {};
  const oldRcByUrl = {};
  (newRcDetails || []).forEach(d => {
    if (d.url) rcByUrl[d.url] = d.src || '';
  });
  (oldRcDetails || []).forEach(d => {
    if (d.url) oldRcByUrl[d.url] = d.src || '';
  });

  const dataElementGroups = includeBreakdown && newSummary ? groupDataElementsByType(newSummary.dataElements, rcByUrl) : {};
  const ruleDetails = includeBreakdown && newSummary ? extractRuleDetails(newSummary.rules, rcByUrl) : [];

  const customActionFindings = [];
  const customCodeFindings = [];
  const generalFindings = [];
  const dataElementUsage = {};
  if (newSummary) {
    const actions = (newSummary.rules || []).flatMap(r => r.actions || []);
    actions.filter(a => a.modulePath === 'core/src/lib/actions/customCode.js').forEach((action, idx) => {
      let src = '';
      if (action.settings) {
        if (action.settings.isExternal && action.settings.source && rcByUrl[action.settings.source]) {
          src = rcByUrl[action.settings.source];
        } else if (action.settings.source) {
          src = action.settings.source.toString();
        }
      }
      const findings = analyzeCustomCode(src || '');
      if (findings.length) {
        customActionFindings.push({
          index: idx + 1,
          kind: 'Action',
          name: action.modulePath ? action.modulePath : 'Custom Code Action',
          ruleName: '',
          findings,
          source: src
        });
      }
    });

    // Custom code data elements
    Object.keys(newSummary.dataElements || {}).forEach(name => {
      const de = newSummary.dataElements[name] || {};
      if (de.modulePath && de.modulePath.endsWith('customCode.js')) {
        const src = de.settings && de.settings.source ? de.settings.source.toString() : '';
        const findings = analyzeCustomCode(src);
        if (findings.length) {
          customCodeFindings.push({
            kind: 'Data Element',
            name,
            ruleName: '',
            findings,
            source: src
          });
        }
      }
    });

    // Custom code conditions/actions with source
    (ruleDetails || []).forEach(rule => {
      (rule.conditions || []).forEach(cond => {
        if (cond.source) {
          const findings = analyzeCustomCode(cond.source);
          if (findings.length) {
            customCodeFindings.push({
              kind: 'Condition',
              name: cond.name,
              ruleName: rule.name,
              findings,
              source: cond.source
            });
          }
        }
      });
      (rule.actions || []).forEach(act => {
        if (act.source) {
          const findings = analyzeCustomCode(act.source);
          if (findings.length) {
            customCodeFindings.push({
              kind: 'Action',
              name: act.name,
              ruleName: rule.name,
              findings,
              source: act.source
            });
          }
        }
      });
    });

    // Data element usage checks (flag if used <= 1 time), including linked dependencies
    const deUsage = {};
    const rulesJson = JSON.stringify(newSummary.rules || []);
    const dataElements = newSummary.dataElements || {};
    const nameSet = new Set(Object.keys(dataElements));

    function extractRefsFromString(str) {
      const refs = new Set();
      if (!str) return refs;
      const re = /%([^%]+)%/g;
      let m;
      while ((m = re.exec(str)) !== null) {
        const name = m[1];
        if (nameSet.has(name)) refs.add(name);
      }
      return refs;
    }

    const depsMap = {};
    Object.keys(dataElements).forEach(name => {
      const de = dataElements[name] || {};
      const settingsStr = JSON.stringify(de.settings || {});
      const sourceStr = de.settings && de.settings.source ? String(de.settings.source) : '';
      const refs = new Set([
        ...extractRefsFromString(settingsStr),
        ...extractRefsFromString(sourceStr)
      ]);
      depsMap[name] = Array.from(refs);
    });

    Object.keys(dataElements).forEach(name => {
      const token = `%${name}%`;
      const count = (rulesJson.split(token).length - 1);
      deUsage[name] = count;
    });

    function propagate(name, count, stack) {
      if (!depsMap[name] || !depsMap[name].length) return;
      for (const dep of depsMap[name]) {
        if (stack.has(dep)) continue;
        deUsage[dep] = (deUsage[dep] || 0) + count;
        stack.add(dep);
        propagate(dep, count, stack);
        stack.delete(dep);
      }
    }

    Object.keys(deUsage).forEach(name => {
      const count = deUsage[name] || 0;
      if (count > 0) {
        propagate(name, count, new Set([name]));
      }
    });

    Object.keys(deUsage).forEach(name => {
      dataElementUsage[name] = deUsage[name] || 0;
      if ((deUsage[name] || 0) <= 1) {
        generalFindings.push({
          type: 'Data Element Usage',
          message: `Data element "${name}" appears ${deUsage[name] || 0} time(s). Rule: only create data elements used in more than one place.`,
          name,
          count: deUsage[name] || 0
        });
      }
    });

    // Duplicate external script loads
    if (newRcDetails && newRcDetails.length) {
      const urlCounts = {};
      newRcDetails.forEach(d => {
        (d.urls || []).forEach(u => {
          urlCounts[u] = (urlCounts[u] || 0) + 1;
        });
      });
      Object.keys(urlCounts).forEach(u => {
        if (urlCounts[u] > 1) {
          generalFindings.push({
            type: 'Duplicate Script',
            message: `Script URL loaded ${urlCounts[u]} times: ${u}. Avoid loading the same script multiple times.`,
            url: u,
            count: urlCounts[u]
          });
        }
      });
    }
  }

  const releaseNotes = oldSummary && generateReleaseNotes ? buildReleaseNotes(newSummary, oldSummary, rcByUrl, oldRcByUrl) : null;

  return {
    release,
    siteName,
    timestamp: formatTimestampForFile(new Date()),
    oldSummary,
    newSummary,
    oldDomains,
    newDomains,
    oldRcCount,
    newRcCount,
    dataElementGroups,
    ruleDetails,
    customActionFindings,
    customCodeFindings,
    generalFindings,
    dataElementUsage,
    config: config || {},
    newRcDetails,
    oldRcDetails,
    releaseNotes
  };
}

module.exports = {
  runAudit,
  formatTimestampForFile,
  prettyModuleName,
  countByModulePath,
  analyzeCustomCode,
  buildReleaseNotes,
  lineDiff
};

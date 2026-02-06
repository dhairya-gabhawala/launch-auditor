// Compute release note diffs between containers.
const { prettyModuleName } = require('../utils/modules');

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

module.exports = {
  lineDiff,
  buildReleaseNotes
};

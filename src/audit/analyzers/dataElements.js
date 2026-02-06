// Data element grouping and usage analysis.

const { prettyModuleName } = require('../utils/modules');

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

function analyzeDataElementUsage(summary) {
  const dataElementUsage = {};
  const generalFindings = [];
  if (!summary) return { dataElementUsage, generalFindings };

  const rulesJson = JSON.stringify(summary.rules || []);
  const dataElements = summary.dataElements || {};
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
    dataElementUsage[name] = count;
  });

  function propagate(name, count, stack) {
    if (!depsMap[name] || !depsMap[name].length) return;
    for (const dep of depsMap[name]) {
      if (stack.has(dep)) continue;
      dataElementUsage[dep] = (dataElementUsage[dep] || 0) + count;
      stack.add(dep);
      propagate(dep, count, stack);
      stack.delete(dep);
    }
  }

  Object.keys(dataElementUsage).forEach(name => {
    const count = dataElementUsage[name] || 0;
    if (count > 0) {
      propagate(name, count, new Set([name]));
    }
  });

  Object.keys(dataElementUsage).forEach(name => {
    const count = dataElementUsage[name] || 0;
    if (count <= 1) {
      generalFindings.push({
        type: 'Data Element Usage',
        message: `Data element "${name}" appears ${count} time(s). Rule: only create data elements used in more than one place.`,
        name,
        count
      });
    }
  });

  return { dataElementUsage, generalFindings };
}

module.exports = {
  groupDataElementsByType,
  analyzeDataElementUsage
};

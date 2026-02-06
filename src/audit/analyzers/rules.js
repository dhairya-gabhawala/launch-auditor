// Normalize rule details for display.

const { prettyModuleName } = require('../utils/modules');

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

module.exports = {
  extractRuleDetails
};

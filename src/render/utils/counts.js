// Count/diff helpers for breakdown and cards.

const { prettyModuleName } = require('../../audit');

function countsToNamedMap(counts) {
  const map = new Map();
  for (const [modulePath, count] of counts) {
    map.set(modulePath, { name: prettyModuleName(modulePath), count });
  }
  return map;
}

function diffCounts(newCounts, oldCounts) {
  const newMap = countsToNamedMap(newCounts);
  const oldMap = countsToNamedMap(oldCounts);
  const keys = new Set([...newMap.keys(), ...oldMap.keys()]);
  const items = [];
  for (const k of keys) {
    const n = newMap.get(k);
    const o = oldMap.get(k);
    const newVal = n ? n.count : 0;
    const oldVal = o ? o.count : 0;
    items.push({
      modulePath: k,
      name: (n && n.name) || (o && o.name) || prettyModuleName(k),
      newVal,
      oldVal,
      delta: newVal - oldVal
    });
  }
  return items.sort((a, b) => b.newVal - a.newVal);
}

function sumCounts(items) {
  return (items || []).reduce((acc, i) => {
    acc.newTotal += i.newVal || 0;
    acc.deltaTotal += i.delta || 0;
    return acc;
  }, { newTotal: 0, deltaTotal: 0 });
}

function countReleaseNoteChanges(items) {
  const counts = { added: 0, removed: 0, updated: 0 };
  (items || []).forEach(i => {
    if (i.change === 'Added') counts.added += 1;
    else if (i.change === 'Removed') counts.removed += 1;
    else if (i.change === 'Updated') counts.updated += 1;
  });
  return counts;
}

function changeMetaHtml(counts) {
  if (!counts) return '';
  const parts = [
    `<span class="text-emerald-700">+${counts.added || 0}</span>`,
    `<span class="text-rose-700">-${counts.removed || 0}</span>`,
    `<span class="text-amber-700">~${counts.updated || 0}</span>`
  ];
  return `<div class="text-xs mt-1 flex gap-2">${parts.join('')}</div>`;
}

function diffCountFromDetails(newDetails, oldDetails, keyFn) {
  const toSet = (arr) => new Set((arr || []).map(keyFn).filter(Boolean));
  const newSet = toSet(newDetails);
  const oldSet = toSet(oldDetails);
  let added = 0;
  let removed = 0;
  newSet.forEach(v => { if (!oldSet.has(v)) added += 1; });
  oldSet.forEach(v => { if (!newSet.has(v)) removed += 1; });
  return { added, removed, updated: 0 };
}

module.exports = {
  countsToNamedMap,
  diffCounts,
  sumCounts,
  countReleaseNoteChanges,
  changeMetaHtml,
  diffCountFromDetails
};

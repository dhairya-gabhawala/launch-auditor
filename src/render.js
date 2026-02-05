const { prettyModuleName, countByModulePath } = require('./audit');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectCodeLang(src) {
  const s = String(src || '').toLowerCase();
  if (s.includes('<html') || s.includes('<div') || s.includes('<script') || s.includes('<body') || s.includes('<span') || s.includes('<p') || s.includes('<a ') || s.includes('<!doctype')) {
    return 'html';
  }
  return 'javascript';
}

function renderCodeBlock(code, lang) {
  const safe = escapeHtml(code || '');
  const dataLang = lang || 'javascript';
  const classLang = dataLang === 'html' || dataLang === 'markup'
    ? 'language-markup'
    : dataLang === 'json'
      ? 'language-json'
      : dataLang === 'diff'
        ? 'language-diff'
        : dataLang === 'text' || dataLang === 'none'
          ? 'language-none'
          : 'language-javascript';
  return `<pre class="text-xs whitespace-pre-wrap line-numbers"><code class="${classLang}" data-lang="${escapeHtml(dataLang)}">${safe}</code></pre>`;
}

function renderDiffBlock(diffText) {
  const safe = escapeHtml(diffText || '');
  return `<pre class="text-xs whitespace-pre-wrap line-numbers"><code class="language-diff" data-lang="diff">${safe}</code></pre>`;
}

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

function renderAccordion(title, bodyHtml) {
  return `<details class="mb-3 border rounded">
    <summary class="cursor-pointer px-3 py-2 font-medium bg-slate-50">${escapeHtml(title)}</summary>
    <div class="p-3">${bodyHtml}</div>
  </details>`;
}

function changeBadge(change) {
  const map = {
    Added: 'bg-emerald-100 text-emerald-800',
    Removed: 'bg-rose-100 text-rose-800',
    Updated: 'bg-amber-100 text-amber-800'
  };
  const cls = map[change] || 'bg-slate-100 text-slate-700';
  return `<span class="text-[11px] px-2 py-0.5 rounded ${cls}">${escapeHtml(change)}</span>`;
}

function renderReleaseSection(title, items) {
  if (!items || !items.length) {
    return `<div class="mb-4">
      <div class="font-medium mb-2">${escapeHtml(title)}</div>
      <div class="text-sm text-slate-600">No changes detected.</div>
    </div>`;
  }
  const rows = items.map(i => `<div class="border rounded p-3 bg-white">
    <div class="flex items-center justify-between mb-1">
      <div class="font-medium text-sm">${escapeHtml(i.name)}</div>
      ${changeBadge(i.change)}
    </div>
    <div class="text-xs text-slate-600">${escapeHtml(i.summary || '')}</div>
    ${i.diff ? `<div class="mt-2">${renderAccordion('View Diff', renderDiffBlock(i.diff))}</div>` : ''}
  </div>`).join('');
  return `<div class="mb-4">
    <div class="font-medium mb-2">${escapeHtml(title)}</div>
    <div class="space-y-2">${rows}</div>
  </div>`;
}

function buildConfluenceReleaseNotes(releaseNotes) {
  if (!releaseNotes) return '';

  function section(title, items, isRules) {
    if (!items || !items.length) {
      return `<h3>${escapeHtml(title)}</h3><p>No changes detected.</p>`;
    }
    const rows = items.map(i => {
      const nameTag = isRules ? 'h4' : 'strong';
      const nameHtml = isRules ? `<${nameTag}>${escapeHtml(i.name)}</${nameTag}>` : `<${nameTag}>${escapeHtml(i.name)}</${nameTag}>`;
      const summary = i.summary ? `<p>${escapeHtml(i.change)} — ${escapeHtml(i.summary)}</p>` : `<p>${escapeHtml(i.change)}</p>`;
      const diff = i.diff ? `<pre><code>${escapeHtml(trimDiffWithContext(i.diff, 3))}</code></pre>` : '';
      return `${nameHtml}${summary}${diff}`;
    }).join('');
    return `<h3>${escapeHtml(title)}</h3>${rows}`;
  }

  return [
    '<h2>Release Notes</h2>',
    section('Extensions', releaseNotes.extensions, false),
    section('Data Elements', releaseNotes.dataElements, false),
    section('Rules', releaseNotes.rules, true)
  ].join('\n');
}

function formatDelta(delta) {
  if (delta > 0) return `▲ +${delta}`;
  if (delta < 0) return `▼ ${delta}`;
  return '— 0';
}

function deltaClass(delta) {
  if (delta > 0) return 'text-emerald-700';
  if (delta < 0) return 'text-rose-700';
  return 'text-slate-500';
}

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

function renderDiffList(items, showDelta) {
  if (!items.length) {
    return '<li class="text-xs text-slate-500 py-2">No items</li>';
  }
  const rows = items.map(i => {
    const deltaText = formatDelta(i.delta);
    const deltaSpan = showDelta ? `<span class="${deltaClass(i.delta)}">${escapeHtml(deltaText)}</span>` : '';
    return `<li class="grid grid-cols-[1fr_48px_64px] items-center text-xs py-2 gap-2">
      <span class="truncate">${escapeHtml(i.name)}</span>
      <span class="text-slate-600 text-right tabular-nums">${i.newVal}</span>
      <span class="text-right tabular-nums">${deltaSpan || ''}</span>
    </li>`;
  }).join('');
  return rows;
}

function summaryCard(title, value, delta, showDelta, metaHtml) {
  const deltaText = showDelta ? formatDelta(delta) : '';
  const deltaSpan = showDelta ? `<div class="text-xs ${deltaClass(delta)}">${escapeHtml(deltaText)}</div>` : '';
  return `<div class="p-4 border rounded bg-white">
    <div class="text-sm text-slate-500">${escapeHtml(title)}</div>
    <div class="text-2xl font-semibold">${escapeHtml(String(value))}</div>
    ${deltaSpan}
    ${metaHtml || ''}
  </div>`;
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

function renderViolationsSummary(findings) {
  const counts = {};
  (findings || []).forEach(f => {
    const key = f.ruleName ? f.ruleName : 'Global / Unscoped';
    counts[key] = (counts[key] || 0) + 1;
  });
  const keys = Object.keys(counts);
  if (!keys.length) {
    return `<div class="mt-6 p-3 border rounded bg-emerald-50 text-emerald-800 text-sm">
      <span class="font-medium">✓ No rule violations detected.</span>
    </div>`;
  }
  const rows = keys.sort().map(k => `<div class="flex items-center justify-between text-sm border-b py-1">
    <span>${escapeHtml(k)}</span>
    <span class="font-medium">${counts[k]}</span>
  </div>`).join('');
  return `<div class="mt-6">
    <div class="font-medium mb-2">Rule Violations</div>
    <div class="border rounded p-2 bg-white">${rows}</div>
  </div>`;
}

function renderReportHtml(model) {
  const {
    release,
    siteName,
    timestamp,
    newSummary,
    oldSummary,
    newDomains,
    oldDomains,
    newRcCount,
    oldRcCount,
    dataElementGroups,
    ruleDetails,
    customActionFindings,
    customCodeFindings,
    generalFindings,
    dataElementUsage,
    config,
    releaseNotes,
    newRcDetails,
    oldRcDetails,
    compare
  } = model;

  const isComparison = !!oldSummary;

  const newRules = newSummary ? newSummary.rules || [] : [];
  const oldRules = oldSummary ? oldSummary.rules || [] : [];
  const newActions = newRules.flatMap(r => r.actions || []);
  const oldActions = oldRules.flatMap(r => r.actions || []);

  const newCustomCodeActions = newActions.filter(a => a.modulePath === 'core/src/lib/actions/customCode.js').length;
  const oldCustomCodeActions = oldActions.filter(a => a.modulePath === 'core/src/lib/actions/customCode.js').length;

  const dataElementCounts = isComparison ? countReleaseNoteChanges((releaseNotes || {}).dataElements) : null;
  const ruleCounts = isComparison ? countReleaseNoteChanges((releaseNotes || {}).rules) : null;
  const extensionCounts = isComparison ? countReleaseNoteChanges((releaseNotes || {}).extensions) : null;
  const customCodeCounts = isComparison ? { added: Math.max(0, newCustomCodeActions - oldCustomCodeActions), removed: Math.max(0, oldCustomCodeActions - newCustomCodeActions), updated: 0 } : null;
  const remoteScriptCounts = isComparison ? diffCountFromDetails(newRcDetails, oldRcDetails, (d) => d && d.url) : null;

  const cards = [
    summaryCard('Data Elements', newSummary ? newSummary.counts.dataElements : 0, isComparison ? (newSummary.counts.dataElements - oldSummary.counts.dataElements) : 0, isComparison, isComparison ? changeMetaHtml(dataElementCounts) : ''),
    summaryCard('Rules', newSummary ? newSummary.counts.rules : 0, isComparison ? (newSummary.counts.rules - oldSummary.counts.rules) : 0, isComparison, isComparison ? changeMetaHtml(ruleCounts) : ''),
    summaryCard('Extensions', newSummary ? newSummary.counts.extensions : 0, isComparison ? (newSummary.counts.extensions - oldSummary.counts.extensions) : 0, isComparison, isComparison ? changeMetaHtml(extensionCounts) : ''),
    summaryCard('Custom Code Actions', newCustomCodeActions, isComparison ? (newCustomCodeActions - oldCustomCodeActions) : 0, isComparison, isComparison ? changeMetaHtml(customCodeCounts) : ''),
    summaryCard('Remote Scripts', newRcCount || 0, isComparison && typeof oldRcCount === 'number' ? (newRcCount - oldRcCount) : 0, isComparison, isComparison ? changeMetaHtml(remoteScriptCounts) : '')
  ];

  const containerInfo = newSummary ? `
    <div class="grid md:grid-cols-2 gap-4 mb-6">
      <div class="p-4 border rounded bg-white">
        <div class="text-sm font-semibold text-slate-900 mb-2">Container</div>
        <div class="text-sm text-slate-600">Build date: ${escapeHtml(newSummary.buildInfo.buildDate || 'n/a')}</div>
        <div class="text-sm text-slate-600">Turbine version: ${escapeHtml(newSummary.buildInfo.turbineVersion || 'n/a')}</div>
        <div class="text-sm text-slate-600">Environment: ${escapeHtml(newSummary.environment.stage || 'n/a')} (${escapeHtml(newSummary.environment.id || 'n/a')})</div>
      </div>
      ${isComparison && compare ? `
      <div class="p-4 border rounded bg-white">
        <div class="text-sm font-semibold text-slate-900 mb-2">Comparison</div>
        <div class="text-sm text-slate-600">New: <span class="font-medium">${escapeHtml((newSummary && newSummary.environment && newSummary.environment.stage) || compare.newLabel || 'new')}</span></div>
        <div class="text-xs text-slate-500 break-all mb-2">${escapeHtml(compare.newUrl || '')}</div>
        <div class="text-sm text-slate-600">Old: <span class="font-medium">${escapeHtml((oldSummary && oldSummary.environment && oldSummary.environment.stage) || compare.oldLabel || 'old')}</span></div>
        <div class="text-xs text-slate-500 break-all">${escapeHtml(compare.oldUrl || '')}</div>
      </div>
      ` : ''}
    </div>
  ` : '';

  const events = countByModulePath(newRules.flatMap(r => r.events || []));
  const conditions = countByModulePath(newRules.flatMap(r => r.conditions || []));
  const actions = countByModulePath(newRules.flatMap(r => r.actions || []));

  const oldEvents = countByModulePath(oldRules.flatMap(r => r.events || []));
  const oldConditions = countByModulePath(oldRules.flatMap(r => r.conditions || []));
  const oldActionCounts = countByModulePath(oldRules.flatMap(r => r.actions || []));

  const eventsDiff = diffCounts(events, oldEvents);
  const conditionsDiff = diffCounts(conditions, oldConditions);
  const actionsDiff = diffCounts(actions, oldActionCounts);

  const dataElementHtml = Object.keys(dataElementGroups || {}).sort().map(type => {
    const items = dataElementGroups[type].map(de => {
      const settings = JSON.stringify(de.settings || {}, null, 2);
      return renderAccordion(`${de.name}`, renderCodeBlock(settings, 'json'));
    }).join('');
    return renderAccordion(type, items || '<div class="text-sm text-slate-600">No items</div>');
  }).join('');

  const rulesHtml = (ruleDetails || []).map(rule => {
    const eventsHtml = (rule.events || []).map(e => renderAccordion(`Event: ${e.name}`, renderCodeBlock(JSON.stringify(e.settings || {}, null, 2), 'json'))).join('');
    const conditionsHtml = (rule.conditions || []).map(c => {
      const hasSrc = !!c.source;
      const code = hasSrc ? c.source : JSON.stringify(c.settings || {}, null, 2);
      const lang = hasSrc ? detectCodeLang(code) : 'json';
      return renderAccordion(`Condition: ${c.name}`, renderCodeBlock(code, lang));
    }).join('');
    const actionsHtml = (rule.actions || []).map(a => {
      const hasSrc = !!a.source;
      const code = hasSrc ? a.source : JSON.stringify(a.settings || {}, null, 2);
      const lang = hasSrc ? detectCodeLang(code) : 'json';
      return renderAccordion(`Action: ${a.name}`, renderCodeBlock(code, lang));
    }).join('');

    return renderAccordion(`Rule: ${rule.name}`, `
      <div class="space-y-2">
        <div>${eventsHtml || '<div class="text-sm text-slate-600">No events</div>'}</div>
        <div>${conditionsHtml || '<div class="text-sm text-slate-600">No conditions</div>'}</div>
        <div>${actionsHtml || '<div class="text-sm text-slate-600">No actions</div>'}</div>
      </div>
    `);
  }).join('');

  const combined = [];
  // Use customCodeFindings only to avoid standalone duplication
  (customCodeFindings || []).forEach(f => combined.push(f));
  const seen = new Set();
  const unique = combined.filter(item => {
    const key = `${item.kind}|${item.name}|${item.ruleName}|${(item.findings || []).map(f=>f.message).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const violationCounts = {};
  unique.forEach(item => {
    (item.findings || []).forEach(f => {
      const key = f.message;
      violationCounts[key] = (violationCounts[key] || 0) + 1;
    });
  });
  const findingsHtml = Object.keys(violationCounts).length
    ? `<ul class="list-disc list-inside text-sm">` +
      Object.keys(violationCounts).sort().map(rule => `<li>${escapeHtml(rule)} <span class="text-slate-500">(${violationCounts[rule]})</span></li>`).join('') +
      `</ul>`
    : '<div class="text-sm text-slate-600">No additional findings detected.</div>';

  const usageEntries = Object.keys(dataElementUsage || {}).sort().map(name => ({
    name,
    count: dataElementUsage[name]
  }));
  const unusedItems = usageEntries.filter(i => i.count === 0);
  const onceItems = usageEntries.filter(i => i.count === 1);

  function renderUsageList(items, badgeClass) {
    if (!items.length) return '<li class="text-xs text-slate-500 py-2">No items</li>';
    return items.map(i => `<li class="flex items-center justify-between text-xs py-2">
      <span>${escapeHtml(i.name)}</span>
      <span class="px-2 py-0.5 rounded ${badgeClass}">${i.count}</span>
    </li>`).join('');
  }

  const generalHtml = `
    <div class="mb-4">
      <div class="font-medium mb-2">Data Element Usage</div>
      <div class="text-xs text-slate-600 mb-3">Only showing unused or used once.</div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="border rounded bg-white">
          <div class="px-4 py-3 border-b">
            <div class="text-sm font-semibold text-slate-900">Unused (0)</div>
            <div class="text-xs text-slate-500">Should be removed or wired in</div>
          </div>
          <ul role="list" class="divide-y divide-slate-100 px-4 py-2">
            ${renderUsageList(unusedItems, 'bg-rose-100 text-rose-800')}
          </ul>
        </div>
        <div class="border rounded bg-white">
          <div class="px-4 py-3 border-b">
            <div class="text-sm font-semibold text-slate-900">Used Once (1)</div>
            <div class="text-xs text-slate-500">Consider inlining unless reused</div>
          </div>
          <ul role="list" class="divide-y divide-slate-100 px-4 py-2">
            ${renderUsageList(onceItems, 'bg-amber-100 text-amber-800')}
          </ul>
        </div>
      </div>
    </div>
  `;

  const codeReviewItems = (customCodeFindings || []).filter(f => (f.findings || []).length).map((f) => {
    const titleParts = [];
    if (f.ruleName) titleParts.push(`Rule: ${f.ruleName}`);
    if (f.kind) titleParts.push(`${f.kind}: ${f.name || 'Custom Code'}`);
    const title = titleParts.join(' · ') || 'Custom Code Review';
    const findingsList = (f.findings || []).map(fd => {
      const line = fd.line ? `Line ${fd.line}: ` : '';
      return `<li>${escapeHtml(line + fd.message)}</li>`;
    }).join('');
    const code = f.source || '';
    const lang = detectCodeLang(code);
    return renderAccordion(title, `
      <div class="text-sm mb-2">
        <div class="font-medium mb-1">Review Notes</div>
        <ul class="list-disc list-inside text-sm text-slate-700">${findingsList}</ul>
      </div>
      <div class="text-sm">
        <div class="font-medium mb-1">Code</div>
        ${renderCodeBlock(code, lang)}
      </div>
    `);
  }).join('');

  const codeReviewHtml = codeReviewItems
    ? `<section class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Custom Code Review Notes</h3>
        <div class="text-sm text-slate-600 mb-2">Showing only items with recommendations.</div>
        ${codeReviewItems}
      </section>`
    : `<section class="mb-6">
        <h3 class="text-lg font-semibold mb-2">Custom Code Review Notes</h3>
        <div class="text-sm text-slate-600">No custom code opportunities found.</div>
      </section>`;

  const opportunitiesHtml = `
    <section class="mb-6">
      <h2 class="text-xl font-semibold mb-2">Opportunities & Best-Practice Checks</h2>
      <div class="text-sm text-slate-600 mb-2">Only items with recommendations are shown below.</div>
      ${typeof newRcCount === 'number' ? `<div class="mb-2">Remote Scripts: <span class="font-medium">${newRcCount}</span></div>` : ''}
      ${config && config.maxRcFiles && newRcCount > config.maxRcFiles ? `<div class="text-sm text-amber-700">Remote Scripts exceed threshold (${newRcCount} > ${config.maxRcFiles}). Consider consolidating rules or using Page Top/Library Loaded only for global rules.</div>` : ''}
      <div class="mt-3 mb-2">Custom code actions: <span class="font-medium">${newCustomCodeActions}</span></div>
      ${config && config.maxCustomCodeActions && newCustomCodeActions > config.maxCustomCodeActions ? `<div class="text-sm text-amber-700">Custom code actions exceed threshold (${newCustomCodeActions} > ${config.maxCustomCodeActions}). Consider using extension actions where possible.</div>` : ''}
      ${newDomains && config && Array.isArray(config.approvedDomains) ? (() => {
        const domainSet = new Set(config.approvedDomains);
        const unapproved = newDomains.map(d => d[0]).filter(d => !domainSet.has(d));
        if (!unapproved.length) return '<div class="text-sm text-emerald-700">All third-party domains are approved.</div>';
        return `<div class="mt-3"><div class="font-medium">Unapproved third-party domains</div>${renderCodeBlock(unapproved.map(d => `- ${d}`).join('\n'), 'text')}</div>`;
      })() : ''}
      ${generalHtml}
    </section>
    ${codeReviewHtml}
    <section class="mb-2">
      <h3 class="text-lg font-semibold mb-2">Rule Violations</h3>
      <div class="text-sm text-slate-600 mb-2">Showing violated rules (not individual items).</div>
      ${findingsHtml}
    </section>
  `;

  const breakdownHtml = `
    <section class="mb-6">
      <h2 class="text-xl font-semibold mb-2">Breakdown</h2>
      <div class="grid md:grid-cols-3 gap-4 mb-6">
        <div class="border rounded bg-white">
          <div class="flex items-center justify-between gap-x-3 px-4 py-3 border-b">
            <div class="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">E</div>
            <div>
              <p class="text-sm font-semibold text-slate-900">Events by type</p>
              <p class="text-xs text-slate-500">Event module usage across rules</p>
            </div>
            ${(() => {
              const totals = sumCounts(eventsDiff);
              return isComparison
                ? `<div class="text-right">
                    <div class="text-sm font-semibold tabular-nums">${totals.newTotal}</div>
                    <div class="text-xs ${deltaClass(totals.deltaTotal)} tabular-nums">${formatDelta(totals.deltaTotal)}</div>
                  </div>`
                : `<div class="text-right text-sm font-semibold tabular-nums">${totals.newTotal}</div>`;
            })()}
          </div>
          <ul role="list" class="divide-y divide-slate-100 px-4 py-2">
            ${renderDiffList(eventsDiff, isComparison)}
          </ul>
        </div>
        <div class="border rounded bg-white">
          <div class="flex items-center justify-between gap-x-3 px-4 py-3 border-b">
            <div class="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">C</div>
            <div>
              <p class="text-sm font-semibold text-slate-900">Conditions by type</p>
              <p class="text-xs text-slate-500">Condition module usage across rules</p>
            </div>
            ${(() => {
              const totals = sumCounts(conditionsDiff);
              return isComparison
                ? `<div class="text-right">
                    <div class="text-sm font-semibold tabular-nums">${totals.newTotal}</div>
                    <div class="text-xs ${deltaClass(totals.deltaTotal)} tabular-nums">${formatDelta(totals.deltaTotal)}</div>
                  </div>`
                : `<div class="text-right text-sm font-semibold tabular-nums">${totals.newTotal}</div>`;
            })()}
          </div>
          <ul role="list" class="divide-y divide-slate-100 px-4 py-2">
            ${renderDiffList(conditionsDiff, isComparison)}
          </ul>
        </div>
        <div class="border rounded bg-white">
          <div class="flex items-center justify-between gap-x-3 px-4 py-3 border-b">
            <div class="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">A</div>
            <div>
              <p class="text-sm font-semibold text-slate-900">Actions by type</p>
              <p class="text-xs text-slate-500">Action module usage across rules</p>
            </div>
            ${(() => {
              const totals = sumCounts(actionsDiff);
              return isComparison
                ? `<div class="text-right">
                    <div class="text-sm font-semibold tabular-nums">${totals.newTotal}</div>
                    <div class="text-xs ${deltaClass(totals.deltaTotal)} tabular-nums">${formatDelta(totals.deltaTotal)}</div>
                  </div>`
                : `<div class="text-right text-sm font-semibold tabular-nums">${totals.newTotal}</div>`;
            })()}
          </div>
          <ul role="list" class="divide-y divide-slate-100 px-4 py-2">
            ${renderDiffList(actionsDiff, isComparison)}
          </ul>
        </div>
      </div>
      <div class="mb-4"><div class="font-medium mb-2">Data Elements (grouped by type)</div>${dataElementHtml || '<div class="text-sm text-slate-600">No data elements</div>'}</div>
      <div class="mb-4"><div class="font-medium mb-2">Rules</div>${rulesHtml || '<div class="text-sm text-slate-600">No rules</div>'}</div>
    </section>
  `;

  const confluenceReleaseNotes = releaseNotes ? buildConfluenceReleaseNotes(releaseNotes) : '';
  const releaseNotesHtml = releaseNotes ? `
    <section class="mb-6">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-semibold">Release Notes</h2>
        <button id="copy-release-notes" class="px-3 py-1.5 text-xs border rounded">Copy for Confluence</button>
      </div>
      <div class="text-sm text-slate-600 mb-2">Summary of changes between old and new containers.</div>
      <div class="text-xs text-slate-500 mb-4">Notes reflect configuration and code changes, which can be more granular than high-level count deltas.</div>
      ${renderReleaseSection('Extensions', releaseNotes.extensions)}
      ${renderReleaseSection('Data Elements', releaseNotes.dataElements)}
      ${renderReleaseSection('Rules', releaseNotes.rules)}
    </section>
  ` : '';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://prismjs.com/themes/prism-okaidia.css"/>
  <script src="https://prismjs.com/components/prism-core.min.js"></script>
  <script src="https://prismjs.com/components/prism-javascript.min.js"></script>
  <script src="https://prismjs.com/components/prism-json.min.js"></script>
  <script src="https://prismjs.com/components/prism-markup.min.js"></script>
  <script src="https://prismjs.com/components/prism-diff.min.js"></script>
  <link rel="stylesheet" href="https://prismjs.com/plugins/line-numbers/prism-line-numbers.css"/>
  <script src="https://prismjs.com/plugins/line-numbers/prism-line-numbers.min.js"></script>
  <script src="https://unpkg.com/prettier@3.3.3/standalone.js"></script>
  <script src="https://unpkg.com/prettier@3.3.3/plugins/babel.js"></script>
  <script src="https://unpkg.com/prettier@3.3.3/plugins/html.js"></script>
  <title>Launch Auditor: ${escapeHtml(release)}</title>
</head>
<body class="bg-slate-50 text-slate-900">
  <main class="max-w-6xl mx-auto p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="32" height="32" rx="8" fill="#0F172A"/>
          <path d="M10 24L18 12L26 24" stroke="#F8FAFC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="18" cy="24" r="2" fill="#F8FAFC"/>
        </svg>
        <div>
          <h1 class="text-2xl font-bold">Launch Auditor</h1>
          <div class="text-sm text-slate-600">Site: ${escapeHtml(siteName)} · Release: ${escapeHtml(release)} · Run: ${escapeHtml(timestamp)}</div>
        </div>
      </div>
    </div>

    <section class="mb-6">
      ${containerInfo}
    </section>

    <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      ${cards.join('')}
    </div>

    <div class="mb-6 border-b">
      <nav class="flex gap-4">
        <button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="breakdown">Breakdown</button>
        <button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="opportunities">Opportunities</button>
        ${releaseNotes ? '<button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="release-notes">Release Notes</button>' : ''}
      </nav>
    </div>

    <section id="tab-breakdown" class="tab-panel">
      ${breakdownHtml}
    </section>

    <section id="tab-opportunities" class="tab-panel hidden">
      ${opportunitiesHtml}
    </section>
    ${releaseNotes ? `
    <section id="tab-release-notes" class="tab-panel hidden">
      ${releaseNotesHtml}
    </section>
    ` : ''}
  </main>

  <script>
    const btns = document.querySelectorAll('.tab-btn');
    const panels = { breakdown: document.getElementById('tab-breakdown'), opportunities: document.getElementById('tab-opportunities')${releaseNotes ? ", 'release-notes': document.getElementById('tab-release-notes')" : ''} };
    function setTab(tab){
      btns.forEach(b=>b.classList.remove('border-slate-900'));
      document.querySelector('[data-tab="'+tab+'"]').classList.add('border-slate-900');
      Object.keys(panels).forEach(k=>panels[k].classList.add('hidden'));
      panels[tab].classList.remove('hidden');
    }
    btns.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    setTab('breakdown');

    // Format code blocks with Prettier (async), then highlight
    document.querySelectorAll('code[data-lang]').forEach((el) => {
      const lang = el.getAttribute('data-lang');
      const source = el.textContent;
      if (lang === 'diff' || lang === 'text' || lang === 'none') {
        if (window.Prism) Prism.highlightElement(el);
        return;
      }
      Promise.resolve(
        prettier.format(source, {
          parser: (lang === 'html' || lang === 'markup') ? 'html' : lang === 'json' ? 'json' : 'babel',
          plugins: (lang === 'html' || lang === 'markup') ? [prettierPlugins.html] : [prettierPlugins.babel],
          semi: true,
          singleQuote: true,
        })
      ).then((formatted) => {
        if (formatted) el.textContent = formatted;
        if (window.Prism) Prism.highlightElement(el);
      }).catch(() => {});
    });

    const copyBtn = document.getElementById('copy-release-notes');
    if (copyBtn) {
      const confluenceHtml = ${JSON.stringify(confluenceReleaseNotes)};
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && window.ClipboardItem) {
            const item = new ClipboardItem({
              'text/html': new Blob([confluenceHtml], { type: 'text/html' }),
              'text/plain': new Blob([confluenceHtml], { type: 'text/plain' })
            });
            await navigator.clipboard.write([item]);
          } else {
            await navigator.clipboard.writeText(confluenceHtml);
          }
          copyBtn.textContent = 'Copied';
          setTimeout(() => copyBtn.textContent = 'Copy for Confluence', 1500);
        } catch (e) {
          copyBtn.textContent = 'Copy failed';
          setTimeout(() => copyBtn.textContent = 'Copy for Confluence', 1500);
        }
      });
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderReportHtml
};

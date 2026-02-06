// Render full audit report HTML using prebuilt section helpers.

const { prettyModuleName, countByModulePath } = require('./audit');
const { escapeHtml } = require('./render/utils/escape');
const { detectCodeLang, renderCodeBlock, renderDiffBlock } = require('./render/utils/code');
const { trimDiffWithContext } = require('./render/utils/diff');
const { renderAccordion } = require('./render/utils/accordion');
const { extractFunctionStrings } = require('./render/utils/functions');
const { formatDelta, deltaClass } = require('./render/utils/delta');
const { diffCounts, sumCounts, countReleaseNoteChanges, changeMetaHtml, diffCountFromDetails } = require('./render/utils/counts');
const { summaryCard } = require('./render/utils/cards');
const { renderDiffList } = require('./render/utils/lists');
const { renderReleaseSection, buildConfluenceReleaseNotes } = require('./render/sections/releaseNotes');

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
      const settingsObj = de.settings || {};
      if (settingsObj && settingsObj.source) {
        const code = String(settingsObj.source || '');
        const lang = detectCodeLang(code);
        const rest = { ...settingsObj };
        delete rest.source;
        const restJson = Object.keys(rest).length ? renderCodeBlock(JSON.stringify(rest, null, 2), 'json') : '';
        const body = `
          <div class="mb-2">
            <div class="text-xs text-slate-500 mb-1">Custom Code</div>
            ${renderCodeBlock(code, lang)}
          </div>
          ${restJson ? `<div class="mt-2"><div class="text-xs text-slate-500 mb-1">Settings</div>${restJson}</div>` : ''}
        `;
        return renderAccordion(`${de.name}`, body);
      }
      const settings = JSON.stringify(settingsObj || {}, null, 2);
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
      const fnSnippets = extractFunctionStrings(c.settings || {});
      const fnBlock = fnSnippets.length
        ? `<div class="mb-2"><div class="text-xs text-slate-500 mb-1">Custom Code</div>${renderCodeBlock(fnSnippets.map(s => s.code).join('\n\n'), 'javascript')}</div>`
        : '';
      const settingsBlock = renderCodeBlock(code, lang);
      return renderAccordion(`Condition: ${c.name}`, fnBlock + settingsBlock);
    }).join('');
    const actionsHtml = (rule.actions || []).map(a => {
      const hasSrc = !!a.source;
      const code = hasSrc ? a.source : JSON.stringify(a.settings || {}, null, 2);
      const lang = hasSrc ? detectCodeLang(code) : 'json';
      const fnSnippets = extractFunctionStrings(a.settings || {});
      const fnBlock = fnSnippets.length
        ? `<div class="mb-2"><div class="text-xs text-slate-500 mb-1">Custom Code</div>${renderCodeBlock(fnSnippets.map(s => s.code).join('\n\n'), 'javascript')}</div>`
        : '';
      const settingsBlock = renderCodeBlock(code, lang);
      return renderAccordion(`Action: ${a.name}`, fnBlock + settingsBlock);
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
  <link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
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
  <style>
    @media print {
      body { background: #fff !important; }
      .no-print { display: none !important; }
      .tabs-nav { display: none !important; }
      body[data-print-title]::before {
        content: attr(data-print-title);
        display: block;
        font-size: 18px;
        font-weight: 700;
        margin: 0 0 12px 0;
        color: #0f172a;
      }
      .tab-panel { display: none !important; }
      .tab-panel.print-only { display: block !important; }
      details { page-break-inside: avoid; }
      pre, code { white-space: pre-wrap !important; }
      .line-numbers-rows { display: none !important; }
      pre { background: #fff !important; color: #000 !important; }
      .shadow, .shadow-sm, .shadow-lg, .shadow-xl { box-shadow: none !important; }
      a { color: #000 !important; text-decoration: none !important; }
    }
  </style>
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
      <div class="no-print">
        <button id="print-report" class="inline-flex items-center gap-2 text-sm border border-slate-300 rounded-md px-3 py-2 bg-white hover:bg-slate-50 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true" class="h-5 w-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
          Print
        </button>
      </div>
    </div>

    <section class="mb-6">
      ${containerInfo}
    </section>

    <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      ${cards.join('')}
    </div>

    <div class="mb-6 border-b tabs-nav">
      <nav class="flex gap-4">
        ${Object.keys(dataElementGroups || {}).length || (ruleDetails || []).length ? '<button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="breakdown">Breakdown</button>' : ''}
        <button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="opportunities">Opportunities</button>
        ${releaseNotes ? '<button class="tab-btn py-2 px-3 border-b-2 border-transparent font-medium" data-tab="release-notes">Release Notes</button>' : ''}
      </nav>
    </div>

    <section id="tab-breakdown" class="tab-panel${Object.keys(dataElementGroups || {}).length || (ruleDetails || []).length ? '' : ' hidden'}">
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

  <dialog id="print-dialog" class="rounded-lg p-0 w-[420px] no-print">
    <form method="dialog" class="p-5 space-y-4">
      <div class="text-lg font-semibold">Print Options</div>
      <div class="text-sm text-slate-600">Choose which tabs to include in the printout.</div>
      <div class="space-y-2 text-sm">
        <label class="flex items-center gap-2">
          <input type="checkbox" id="print-all" class="h-4 w-4 rounded border-slate-300 text-slate-900" checked />
          <span>Print all tabs</span>
        </label>
        <div class="pl-6 space-y-2">
          <label class="flex items-center gap-2">
            <input type="checkbox" class="print-tab h-4 w-4 rounded border-slate-300 text-slate-900" data-tab="breakdown" checked />
            <span>Breakdown</span>
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" class="print-tab h-4 w-4 rounded border-slate-300 text-slate-900" data-tab="opportunities" checked />
            <span>Opportunities</span>
          </label>
          ${releaseNotes ? `
          <label class="flex items-center gap-2">
            <input type="checkbox" class="print-tab h-4 w-4 rounded border-slate-300 text-slate-900" data-tab="release-notes" checked />
            <span>Release Notes</span>
          </label>
          ` : ''}
        </div>
      </div>
      <div class="flex justify-end gap-2 pt-2">
        <button id="print-cancel" class="px-3 py-2 border rounded" type="button">Cancel</button>
        <button id="print-confirm" class="px-3 py-2 bg-slate-900 text-white rounded" value="default">Print</button>
      </div>
    </form>
  </dialog>

  <script>
    const btns = document.querySelectorAll('.tab-btn');
    const panels = { ${Object.keys(dataElementGroups || {}).length || (ruleDetails || []).length ? "breakdown: document.getElementById('tab-breakdown')," : ""} opportunities: document.getElementById('tab-opportunities')${releaseNotes ? ", 'release-notes': document.getElementById('tab-release-notes')" : ''} };
    function setTab(tab){
      btns.forEach(b=>b.classList.remove('border-slate-900'));
      document.querySelector('[data-tab="'+tab+'"]').classList.add('border-slate-900');
      Object.keys(panels).forEach(k=>panels[k].classList.add('hidden'));
      panels[tab].classList.remove('hidden');
    }
    btns.forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
    setTab(${Object.keys(dataElementGroups || {}).length || (ruleDetails || []).length ? "'breakdown'" : "'opportunities'"});

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

    const printBtn = document.getElementById('print-report');
    if (printBtn) {
      const printDialog = document.getElementById('print-dialog');
      const printAll = document.getElementById('print-all');
      const tabChecks = Array.from(document.querySelectorAll('.print-tab'));
      const cancelBtn = document.getElementById('print-cancel');
      const confirmBtn = document.getElementById('print-confirm');

      function syncTabsDisabled() {
        const disabled = printAll.checked;
        tabChecks.forEach(cb => {
          cb.disabled = disabled;
          cb.parentElement.classList.toggle('opacity-50', disabled);
        });
      }
      if (printAll) {
        printAll.addEventListener('change', syncTabsDisabled);
        syncTabsDisabled();
      }
      if (cancelBtn) cancelBtn.addEventListener('click', () => printDialog.close());

      if (confirmBtn) {
        confirmBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const panels = document.querySelectorAll('.tab-panel');
          panels.forEach(p => p.classList.remove('print-only'));
          if (printAll && printAll.checked) {
            panels.forEach(p => p.classList.add('print-only'));
          } else {
            panels.forEach(p => {
              const id = p.id || '';
              const key = id.replace('tab-', '');
              const match = tabChecks.find(cb => cb.dataset.tab === key);
              if (match && match.checked) p.classList.add('print-only');
            });
          }
          if (printAll && printAll.checked) {
            document.body.setAttribute('data-print-title', 'All Tabs');
          } else {
            const selectedNames = tabChecks.filter(cb => cb.checked).map(cb => cb.nextElementSibling ? cb.nextElementSibling.textContent.trim() : cb.dataset.tab);
            document.body.setAttribute('data-print-title', selectedNames.join(', '));
          }
          printDialog.close();
          window.print();
          // Restore active tab after print
          setTab(document.querySelector('.tab-btn.border-slate-900')?.dataset.tab || 'breakdown');
          document.body.removeAttribute('data-print-title');
        });
      }

      printBtn.addEventListener('click', () => printDialog.showModal());
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderReportHtml
};

// Orchestrates audit analysis and report model generation.

const fs = require('fs');
const path = require('path');

const { ensureDir } = require('./lib/fs');
const { downloadContainer } = require('./audit/utils/fetch');
const { loadContainer, summarizeContainer } = require('./audit/utils/container');
const { downloadRcFiles, domainInventory } = require('./audit/utils/rc');
const { groupDataElementsByType, analyzeDataElementUsage } = require('./audit/analyzers/dataElements');
const { extractRuleDetails } = require('./audit/analyzers/rules');
const { analyzeCustomCode } = require('./audit/analyzers/customCode');
const { buildReleaseNotes, lineDiff } = require('./audit/analyzers/releaseNotes');
const { prettyModuleName, countByModulePath } = require('./audit/utils/modules');
const { formatTimestampForFile } = require('./audit/utils/time');

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

    const usageAnalysis = analyzeDataElementUsage(newSummary);
    Object.keys(usageAnalysis.dataElementUsage).forEach(name => {
      dataElementUsage[name] = usageAnalysis.dataElementUsage[name];
    });
    generalFindings.push(...usageAnalysis.generalFindings);

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

const fs = require('fs');
const path = require('path');
const { RUNS_ROOT } = require('./paths');
const { ensureDir } = require('./fs');

function listRuns() {
  ensureDir(RUNS_ROOT);
  const sites = fs.readdirSync(RUNS_ROOT).filter(name => fs.statSync(path.join(RUNS_ROOT, name)).isDirectory());
  const grouped = {};
  for (const site of sites) {
    const siteDir = path.join(RUNS_ROOT, site);
    const runDirs = fs.readdirSync(siteDir).filter(name => fs.statSync(path.join(siteDir, name)).isDirectory());
    const runs = runDirs.map(run => {
      const runDir = path.join(siteDir, run);
      const reportFile = fs.readdirSync(runDir).find(f => f.endsWith('.html'));
      const mtime = fs.statSync(runDir).mtimeMs || 0;
      return {
        site,
        run,
        reportPath: reportFile ? `/runs/${site}/${run}/${reportFile}` : '',
        isError: reportFile ? reportFile.includes('error.html') : false,
        mtime
      };
    }).filter(r => r.reportPath).sort((a, b) => (b.mtime - a.mtime) || (a.run < b.run ? 1 : -1));
    if (runs.length) {
      grouped[site] = runs;
    }
  }
  return grouped;
}

module.exports = {
  listRuns
};

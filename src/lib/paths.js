const path = require('path');

const SCRIPT_DIR = path.resolve(__dirname, '..', '..');
const RUNS_ROOT = path.join(SCRIPT_DIR, 'runs');
const CONFIG_PATH = path.join(SCRIPT_DIR, 'config.json');

module.exports = {
  SCRIPT_DIR,
  RUNS_ROOT,
  CONFIG_PATH
};

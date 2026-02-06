const path = require('path');

const APP_ROOT = process.env.LAUNCH_AUDITOR_APP_ROOT
  ? path.resolve(process.env.LAUNCH_AUDITOR_APP_ROOT)
  : path.resolve(__dirname, '..', '..');

const DATA_ROOT = process.env.LAUNCH_AUDITOR_DATA_DIR
  ? path.resolve(process.env.LAUNCH_AUDITOR_DATA_DIR)
  : APP_ROOT;

const RUNS_ROOT = path.join(DATA_ROOT, 'runs');
const CONFIG_PATH = path.join(DATA_ROOT, 'config.json');

module.exports = {
  APP_ROOT,
  DATA_ROOT,
  RUNS_ROOT,
  CONFIG_PATH
};

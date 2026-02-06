const fs = require('fs');
const path = require('path');

const appRoot = process.env.LAUNCH_AUDITOR_APP_ROOT
  ? path.resolve(process.env.LAUNCH_AUDITOR_APP_ROOT)
  : path.resolve(__dirname, '..');
const dataRoot = process.env.LAUNCH_AUDITOR_DATA_DIR
  ? path.resolve(process.env.LAUNCH_AUDITOR_DATA_DIR)
  : appRoot;
const configPath = path.join(dataRoot, 'config.json');
const templatePath = path.join(appRoot, 'config.template.json');

if (fs.existsSync(configPath)) {
  process.exit(0);
}

fs.mkdirSync(dataRoot, { recursive: true });

if (!fs.existsSync(templatePath)) {
  fs.writeFileSync(configPath, JSON.stringify({ sites: {} }, null, 2) + '\n');
  process.exit(0);
}

const template = fs.readFileSync(templatePath, 'utf8');
fs.writeFileSync(configPath, template.endsWith('\n') ? template : template + '\n');

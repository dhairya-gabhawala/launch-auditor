const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'config.json');
const templatePath = path.join(root, 'config.template.json');

if (fs.existsSync(configPath)) {
  process.exit(0);
}

if (!fs.existsSync(templatePath)) {
  fs.writeFileSync(configPath, JSON.stringify({ sites: {} }, null, 2) + '\n');
  process.exit(0);
}

const template = fs.readFileSync(templatePath, 'utf8');
fs.writeFileSync(configPath, template.endsWith('\n') ? template : template + '\n');

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceSvg = path.join(root, 'public', 'favicon.svg');
const outputDir = path.join(root, 'build');
const outputPng = path.join(outputDir, 'icon.png');

if (!fs.existsSync(sourceSvg)) {
  console.error(`Missing source icon: ${sourceSvg}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

sharp(sourceSvg)
  .resize(512, 512)
  .png()
  .toFile(outputPng)
  .then(() => {
    console.log(`Wrote ${outputPng}`);
  })
  .catch(error => {
    console.error('Failed to build icons:', error);
    process.exit(1);
  });

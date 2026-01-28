const fs = require('fs');
const path = require('path');

const targets = ['build', 'dist'];

for (const target of targets) {
  const fullPath = path.join(__dirname, '..', target);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
}

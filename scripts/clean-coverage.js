const fs = require('fs');
const path = require('path');

const target = path.resolve(
  process.env.COVERAGE_DIR || path.join(__dirname, '..', 'coverage')
);

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}

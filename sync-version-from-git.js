// sync-version-from-git.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getLatestTag() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    return tag.startsWith('v') ? tag.slice(1) : tag;
  } catch (e) {
    console.error('Could not get latest git tag:', e.message);
    process.exit(1);
  }
}

function updatePackageJson(version) {
  const pkgPath = path.resolve(__dirname, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated package.json version to ${version}`);
}

const version = getLatestTag();
updatePackageJson(version);
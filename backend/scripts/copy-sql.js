const fs = require('node:fs');
const path = require('node:path');

const sourceDir = path.resolve(__dirname, '..', 'sql');
const targetDir = path.resolve(__dirname, '..', 'dist', 'sql');

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`SQL source directory not found at "${sourceDir}". Skipping copy.`);
    return;
  }

  try {
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  } catch (error) {
    console.error('Failed to copy SQL assets into the build output.', error);
    process.exitCode = 1;
  }
}

main();

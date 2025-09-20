#!/usr/bin/env node
const { spawn } = require('node:child_process');

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
}

const child = spawn(
  'node',
  ['--test', '--import', 'tsx', 'tests/*.test.ts'],
  {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

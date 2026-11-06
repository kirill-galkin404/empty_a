'use strict';

const { spawn } = require('node:child_process');

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const commands = [
  { name: 'api', args: ['--prefix', 'apps/backend', 'start'] },
  { name: 'web', args: ['--prefix', 'apps/frontend', 'start'] }
];

if (process.argv.includes('--dry-run')) {
  commands.forEach((c) => console.log(`[${c.name}] npm ${c.args.join(' ')}`));
  process.exit(0);
}

const children = [];
let stopping = false;
let exitCode = 0;

function stopAll(signal) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill(signal || 'SIGTERM');
  });
}

commands.forEach((c) => {
  const child = spawn(npm, c.args, { stdio: 'inherit', shell: process.platform === 'win32' });
  children.push(child);
  child.on('error', (err) => {
    console.error(`[${c.name}] failed to start: ${err.message}`);
    exitCode = 1;
    stopAll();
  });
  child.on('exit', (code) => {
    if (!stopping && code) exitCode = code;
    stopAll();
    if (children.every((ch) => ch.exitCode !== null || ch.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
});

process.on('SIGINT', () => stopAll('SIGINT'));
process.on('SIGTERM', () => stopAll('SIGTERM'));
process.on('exit', () => stopAll());

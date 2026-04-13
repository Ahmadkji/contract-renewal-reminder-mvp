#!/usr/bin/env node

const { existsSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { arch, platform } = require('node:process');

if (platform !== 'linux' || arch !== 'x64') {
  console.error(
    'vercel:deploy:prebuilt:prod is only supported on Linux x64. This app uses sharp, so prebuilt output generated on other platforms can differ from Vercel production.',
  );
  process.exit(1);
}

if (!existsSync('.vercel/output')) {
  console.error('Missing .vercel/output. Run `npm run vercel:build:prod` first.');
  process.exit(1);
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['vercel@latest', 'deploy', '--prebuilt', '--prod'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);

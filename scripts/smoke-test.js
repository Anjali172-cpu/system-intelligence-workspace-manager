#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const smokeFilePath = path.join(projectRoot, 'workspace', 'smoke-test.js');

const commands = [
  ['node src/index.js --help', ['src/index.js', '--help']],
  ['node src/index.js report', ['src/index.js', 'report']],
  [
    'node src/index.js report --json outputs/smoke-report.json',
    ['src/index.js', 'report', '--json', 'outputs/smoke-report.json']
  ],
  [
    'node src/index.js create smoke-test.js --content "console.log(\'smoke\')"',
    ['src/index.js', 'create', 'smoke-test.js', '--content', "console.log('smoke')"]
  ],
  ['node src/index.js read smoke-test.js', ['src/index.js', 'read', 'smoke-test.js']],
  [
    'node src/index.js update smoke-test.js --content "\\nconsole.log(\'updated\')"',
    ['src/index.js', 'update', 'smoke-test.js', '--content', "\nconsole.log('updated')"]
  ],
  ['node src/index.js workspace:stats', ['src/index.js', 'workspace:stats']],
  ['node src/index.js history --limit 5', ['src/index.js', 'history', '--limit', '5']],
  ['node src/index.js delete smoke-test.js', ['src/index.js', 'delete', 'smoke-test.js']]
];

function removeStaleFixture() {
  try {
    fs.rmSync(smokeFilePath, { force: true });
  } catch (error) {
    console.error(`[FAIL] Smoke test setup: ${error.message}`);
    process.exit(1);
  }
}

function runCommand(label, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: process.env
  });

  if (result.status === 0 && !result.error) {
    console.log(`[PASS] ${label}`);
    return true;
  }

  console.error(`[FAIL] ${label}`);
  console.error(`Exit code: ${result.status ?? 'Not Available'}`);

  if (result.error) {
    console.error(`Reason: ${result.error.message}`);
  }

  if (result.stdout?.trim()) {
    console.error(`stdout:\n${result.stdout.trim()}`);
  }

  if (result.stderr?.trim()) {
    console.error(`stderr:\n${result.stderr.trim()}`);
  }

  return false;
}

removeStaleFixture();

console.log('Running CLI smoke tests...\n');
const results = commands.map(([label, args]) => runCommand(label, args));
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log(`\nSmoke test summary: ${passed} passed, ${failed} failed.`);
process.exitCode = failed > 0 ? 1 : 0;


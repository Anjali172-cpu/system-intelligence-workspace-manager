#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.join(projectRoot, 'outputs', 'reliability-report.json');
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const testedAreas = [
  'Help command',
  'System report',
  'JSON export',
  'CRUD operations',
  'Workspace statistics',
  'Operation history',
  'Error handling',
  'Path safety validation'
];

const smokeResult = spawnSync(npmExecutable, ['run', 'smoke:test'], {
  cwd: projectRoot,
  encoding: 'utf8',
  env: process.env
});

const combinedOutput = `${smokeResult.stdout ?? ''}\n${smokeResult.stderr ?? ''}`;
const summary = combinedOutput.match(/Smoke test summary:\s*(\d+) passed,\s*(\d+) failed\./);
const passed = summary ? Number.parseInt(summary[1], 10) : 0;
const failed = summary ? Number.parseInt(summary[2], 10) : 1;
const totalTests = passed + failed;
const reliabilityScore = totalTests > 0
  ? Number(((passed / totalTests) * 100).toFixed(2))
  : 0;

const report = {
  generatedAt: new Date().toISOString(),
  totalTests,
  passed,
  failed,
  reliabilityScore,
  testedAreas
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('\nProject Reliability Report');
console.log('==========================');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Reliability Score: ${reliabilityScore}%`);
console.log(`Report: ${path.relative(projectRoot, outputPath)}`);

if (!summary) {
  console.error('\nUnable to parse the smoke test summary.');
  if (smokeResult.error) {
    console.error(`Reason: ${smokeResult.error.message}`);
  }
  if (combinedOutput.trim()) {
    console.error(combinedOutput.trim());
  }
}

process.exitCode = smokeResult.status === 0 && failed === 0 ? 0 : 1;


#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SystemCollector } from './collectors/systemCollector.js';
import { FileCrudManager } from './fileManager/fileCrudManager.js';
import { printCliError, printFileMetadata, printReport, printSection } from './utils/formatter.js';
import { Logger } from './utils/logger.js';
import { CliError, parsePositiveInteger, validateContent, validateWriteMode } from './utils/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const workspaceDirectory = path.join(projectRoot, 'workspace');
const historyLogPath = path.join(workspaceDirectory, '.operation-history.log');

const logger = new Logger({ logFilePath: historyLogPath });
const fileManager = new FileCrudManager({ workspaceDirectory, logger });
const systemCollector = new SystemCollector();

/**
 * Main CLI entrypoint.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { command, positional, options } = parseArguments(process.argv.slice(2));

  try {
    await fileManager.initialize();

    switch (command) {
      case 'report':
        await handleReport(options);
        break;
      case 'create':
        await handleCreate(positional, options);
        break;
      case 'read':
        await handleRead(positional);
        break;
      case 'update':
        await handleUpdate(positional, options);
        break;
      case 'delete':
        await handleDelete(positional);
        break;
      case 'workspace:stats':
        await handleWorkspaceStats();
        break;
      case 'history':
        await handleHistory(options);
        break;
      case 'demo':
        await handleDemo(options);
        break;
      case 'help':
        printHelp();
        break;
      default:
        throw new CliError(
          `Invalid Command: ${command}`,
          `"${command}" is not a recognized CLI command.`,
          'Run the help command to see all supported commands.',
          'node src/index.js help'
        );
    }
  } catch (error) {
    printCliError(error);
    process.exitCode = 1;
  }
}

/**
 * Parses CLI arguments into command, positional values, and named options.
 *
 * @param {string[]} args raw process arguments
 * @returns {{ command: string, positional: string[], options: Record<string, string | boolean> }}
 */
function parseArguments(args) {
  const [rawCommand = 'help', ...rest] = args;
  const positional = [];
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];

    if (value.startsWith('--')) {
      const optionName = value.slice(2);
      const nextValue = rest[index + 1];

      if (nextValue !== undefined && !nextValue.startsWith('--')) {
        options[optionName] = nextValue;
        index += 1;
      } else {
        options[optionName] = true;
      }
    } else {
      positional.push(value);
    }
  }

  return {
    command: rawCommand,
    positional,
    options
  };
}

async function handleReport(options) {
  const report = await buildReport();
  printReport(report);
  await exportJsonIfRequested(report, options.json);
}

async function handleCreate(positional, options) {
  const [relativePath] = positional;
  validateFileName(relativePath);
  const content = await resolveContent(options);
  const metadata = await fileManager.createFile(relativePath, content);
  logger.success(`Created ${metadata.relativePath}`);
  printFileMetadata('Created File', metadata);
}

async function handleRead(positional) {
  const [relativePath] = positional;
  const { content, metadata } = await fileManager.readFile(relativePath);

  printFileMetadata('Read File', metadata);
  printSection('File Contents');
  console.log(content || '(empty file)');
}

async function handleUpdate(positional, options) {
  const [relativePath] = positional;
  validateFileName(relativePath);
  const content = await resolveContent(options);
  const mode = validateWriteMode(options.mode);
  const metadata = await fileManager.updateFile(relativePath, content, mode);
  logger.success(`Updated ${metadata.relativePath} using ${mode} mode`);
  printFileMetadata('Updated File', metadata);
}

async function handleDelete(positional) {
  const [relativePath] = positional;
  const metadata = await fileManager.deleteFile(relativePath);
  logger.success(`Deleted ${metadata.relativePath}`);
  printFileMetadata('Deleted File', metadata);
}

async function handleWorkspaceStats() {
  const statistics = await fileManager.getWorkspaceStatistics();
  printSection('Workspace Statistics');
  console.table(
    statistics.files.map((file) => ({
      Path: file.relativePath,
      Bytes: file.sizeBytes,
      Created: file.createdAt,
      Modified: file.modifiedAt
    }))
  );
  console.log(`Total files: ${statistics.totalFiles}`);
  console.log(`Total bytes: ${statistics.totalSizeBytes}`);
}

async function handleHistory(options) {
  const limit = parsePositiveInteger(options.limit, 20);

  try {
    const rawHistory = await fs.readFile(historyLogPath, 'utf8');
    const entries = rawHistory
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .slice(-limit);

    printSection('File Operation History');
    console.table(
      entries.map((entry) => ({
        Timestamp: entry.timestamp,
        Action: entry.action,
        Path: entry.details?.relativePath ?? 'Not Available'
      }))
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('No file operation history has been recorded yet.');
      return;
    }
    throw error;
  }
}

async function handleDemo(options) {
  const demoFilePath = 'demo/hello.js';
  const demoContent = [
    '/** Demo file generated by System Intelligence & Code Workspace Manager. */',
    "console.log('Hello from the managed workspace.');",
    ''
  ].join('\n');

  try {
    await fileManager.createFile(demoFilePath, demoContent);
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
    await fileManager.updateFile(demoFilePath, demoContent, 'overwrite');
  }

  await fileManager.updateFile(demoFilePath, "// Updated during CLI demo.\n", 'append');
  const readResult = await fileManager.readFile(demoFilePath);
  logger.success(`Demo file is ready: ${readResult.metadata.relativePath}`);

  const report = await buildReport();
  printReport(report);
  await exportJsonIfRequested(report, options.json);
}

async function buildReport() {
  const collected = systemCollector.collect();
  const workspaceStatistics = await fileManager.getWorkspaceStatistics();
  const generatedTimestamp = new Date().toISOString();
  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

  return {
    reportMetadata: {
      reportId: randomUUID(),
      generatedTimestamp,
      cliVersion: packageJson.version
    },
    generatedAt: generatedTimestamp,
    ...collected,
    workspaceStatistics,
    workspaceInsights: workspaceStatistics.insights
  };
}

async function exportJsonIfRequested(payload, outputPath) {
  if (!outputPath) {
    return;
  }

  const safeOutputPath = path.resolve(projectRoot, String(outputPath));
  const relativeToProject = path.relative(projectRoot, safeOutputPath);

  if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
    throw new Error('JSON export path must stay inside the project directory.');
  }

  await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
  await fs.writeFile(safeOutputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  logger.success(`JSON report exported to ${relativeToProject}`);
}

async function resolveContent(options) {
  if (typeof options.content === 'string') {
    return validateContent(options.content);
  }

  if (typeof options.file === 'string') {
    const inputPath = path.resolve(projectRoot, options.file);
    const relativeToProject = path.relative(projectRoot, inputPath);

    if (relativeToProject.startsWith('..') || path.isAbsolute(relativeToProject)) {
      throw new Error('Input content file must stay inside the project directory.');
    }

    return validateContent(await fs.readFile(inputPath, 'utf8'));
  }

  return validateContent(options.content);
}

function validateFileName(relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    throw new CliError(
      'Missing File Name',
      'No workspace file name was provided for this operation.',
      'Add a workspace-relative file name after the command.',
      "node src/index.js create app.js --content \"console.log('hello')\""
    );
  }
}

function printHelp() {
  printSection('System Intelligence & Code Workspace Manager');
  console.log('Usage: node src/index.js <command> [arguments] [options]\n');
  console.log('Commands:');
  console.log('  report --json <path>                  Display system/workspace report and optionally export JSON');
  console.log('  create <file> --content <text>        Create a workspace file');
  console.log('  read <file>                           Read a workspace file');
  console.log('  update <file> --content <text>        Append to a workspace file');
  console.log('  update <file> --mode overwrite --content <text>');
  console.log('  delete <file>                         Delete a workspace file');
  console.log('  workspace:stats                       Display workspace statistics');
  console.log('  history --limit <number>              Display file operation history');
  console.log('  demo --json <path>                    Run a safe end-to-end demo');
  console.log('\nExamples:');
  console.log("  node src/index.js create app.js --content \"console.log('hi')\"");
  console.log('  node src/index.js update app.js --mode append --content "\\nconsole.log(process.version)"');
  console.log('  node src/index.js report --json sample-output.json');
}

await main();

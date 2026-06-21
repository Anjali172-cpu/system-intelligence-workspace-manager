import path from 'node:path';

const CODE_FILE_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml'
]);

/**
 * User-facing error containing recovery guidance for CLI failures.
 */
export class CliError extends Error {
  constructor(title, reason, suggestion, example) {
    super(reason);
    this.name = 'CliError';
    this.title = title;
    this.reason = reason;
    this.suggestion = suggestion;
    this.example = example;
  }
}

/**
 * Ensures required text input is present and meaningful.
 *
 * @param {string | undefined} value user-provided text
 * @param {string} fieldName display name for errors
 * @returns {string} trimmed value
 */
export function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CliError(
      `Missing ${fieldName}`,
      `A ${fieldName.toLowerCase()} was not provided.`,
      `Provide the required ${fieldName.toLowerCase()} after the command.`,
      "node src/index.js create app.js --content \"console.log('hello')\""
    );
  }

  return value.trim();
}

/**
 * Validates and normalizes a workspace-relative file path.
 *
 * @param {string | undefined} inputPath workspace-relative file path
 * @returns {string} normalized POSIX-like relative path
 */
export function validateWorkspaceFilePath(inputPath) {
  if (typeof inputPath !== 'string' || inputPath.trim().length === 0) {
    throw new CliError(
      'Missing File Name',
      'No workspace file name was provided for this operation.',
      'Add a workspace-relative file name after the command.',
      'node src/index.js read app.js'
    );
  }

  const rawPath = inputPath.trim();

  if (path.isAbsolute(rawPath)) {
    throw invalidWorkspacePathError(rawPath);
  }

  const normalized = path.normalize(rawPath);

  if (extension && !CODE_FILE_EXTENSIONS.has(extension)) {
  throw new CliError(
    'Unsupported File Extension',
    `The extension "${extension}" is not supported. Allowed extensions: ${[...CODE_FILE_EXTENSIONS].sort().join(', ')}.`,
    'Use a supported code or text file extension inside the workspace.',
    'node src/index.js create app.js --content "console.log(\'hello\')"'
  );
}

  const extension = path.extname(normalized).toLowerCase();
  if (extension && !CODE_FILE_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported file extension "${extension}". Allowed: ${[...CODE_FILE_EXTENSIONS].sort().join(', ')}`);
  }

  return normalized;
}

/**
 * Identifies files that use one of the workspace's supported code extensions.
 *
 * @param {string} filePath file path to inspect
 * @returns {boolean} whether the path represents a supported code file
 */
export function isCodeFilePath(filePath) {
  return CODE_FILE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Validates a search keyword without allowing it to be interpreted as a path.
 *
 * @param {unknown} keyword search term
 * @returns {string} validated keyword with surrounding whitespace removed
 */
export function validateSearchKeyword(keyword) {
  if (typeof keyword !== 'string' || keyword.trim().length === 0) {
    throw new CliError(
      'Missing Search Keyword',
      'No keyword was provided for the workspace search.',
      'Add a non-empty keyword after the search command.',
      'node src/index.js search console'
    );
  }

  const normalized = keyword.trim();
  const normalizedPath = path.normalize(normalized);
  if (
    path.isAbsolute(normalized)
    || normalizedPath === '..'
    || normalizedPath.startsWith(`..${path.sep}`)
    || normalized.includes('../')
    || normalized.includes('..\\')
    || normalized.includes('\0')
  ) {
    throw new CliError(
      'Invalid Search Keyword',
      'Path traversal and external file references are not allowed in workspace search.',
      'Provide plain text to search within readable workspace code files.',
      'node src/index.js search console'
    );
  }

  return normalized;
}

/**
 * Validates content while preserving the exact text supplied by the user.
 *
 * @param {unknown} value content option value
 * @returns {string} validated original content
 */
export function validateContent(value) {
  if (value === undefined || value === true) {
    throw new CliError(
      'Missing Content',
      'No content was supplied with --content or --file.',
      'Provide text with --content, or load text from a project-local file with --file.',
      "node src/index.js create app.js --content \"console.log('hello')\""
    );
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CliError(
      'Empty Content',
      'The supplied content contains no usable text.',
      'Provide non-empty source code or text.',
      "node src/index.js update app.js --content \"console.log('updated')\""
    );
  }

  return value;
}

/**
 * Validates update mode for file writes.
 *
 * @param {string | undefined} mode write mode
 * @returns {'append' | 'overwrite'} normalized mode
 */
export function validateWriteMode(mode = 'append') {
  const normalized = String(mode).trim().toLowerCase();

  if (!['append', 'overwrite'].includes(normalized)) {
    throw new CliError(
  'Invalid Write Mode',
  'The write mode must be either "append" or "overwrite".',
  'Use a supported write mode.',
  'node src/index.js update app.js --mode append --content "console.log(\'updated\')"'
);
  }

  return normalized;
}

function invalidWorkspacePathError(inputPath) {
  return new CliError(
    'Invalid Workspace Path',
    `The path "${inputPath}" would access a location outside the workspace directory.`,
    'Use a relative path without leading slashes or parent-directory segments such as "..".',
    "node src/index.js create src/app.js --content \"console.log('safe')\""
  );
}

/**
 * Parses a positive integer option.
 *
 * @param {string | undefined} value raw CLI option
 * @param {number} fallback default value
 * @returns {number} parsed positive integer
 */
export function parsePositiveInteger(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
  throw new CliError(
    'Invalid Limit',
    'The limit value must be a positive integer greater than zero.',
    'Provide a numeric limit such as 5, 10, or 20.',
    'node src/index.js history --limit 10'
  );
}

  return parsed;
}

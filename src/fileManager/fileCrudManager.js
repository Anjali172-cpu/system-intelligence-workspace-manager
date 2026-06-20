import fs from 'node:fs/promises';
import path from 'node:path';
import { formatTimestamp } from '../utils/formatter.js';
import {
  CliError,
  isCodeFilePath,
  validateSearchKeyword,
  validateWorkspaceFilePath,
  validateWriteMode
} from '../utils/validator.js';

/**
 * Manages code files inside a dedicated workspace directory.
 */
export class FileCrudManager {
  /**
   * @param {{ workspaceDirectory: string, logger: import('../utils/logger.js').Logger }} options manager dependencies
   */
  constructor({ workspaceDirectory, logger }) {
    this.workspaceDirectory = workspaceDirectory;
    this.logger = logger;
  }

  /**
   * Ensures the workspace exists.
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    await fs.mkdir(this.workspaceDirectory, { recursive: true });
  }

  /**
   * Creates a new file.
   *
   * @param {string} relativePath workspace-relative path
   * @param {string} content file content
   * @returns {Promise<Record<string, unknown>>} file metadata
   */
  async createFile(relativePath, content = '') {
    const safePath = validateWorkspaceFilePath(relativePath);
    const absolutePath = this.#resolveWorkspacePath(safePath);

    await this.initialize();
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    try {
      await fs.writeFile(absolutePath, content, { encoding: 'utf8', flag: 'wx' });
      const metadata = await this.getFileMetadata(safePath, 'create');
      await this.logger.history('CREATE_FILE', metadata);
      return metadata;
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new CliError(
          `File Already Exists: ${safePath}`,
          'Create cannot replace an existing workspace file.',
          'Use update with overwrite mode to replace its contents.',
          `node src/index.js update ${safePath} --mode overwrite --content "console.log('updated')"`
        );
      }
      throw this.#normalizeFileError(error, safePath, 'create');
    }
  }

  /**
   * Reads file contents and metadata.
   *
   * @param {string} relativePath workspace-relative path
   * @returns {Promise<{ content: string, metadata: Record<string, unknown> }>} file content and metadata
   */
  async readFile(relativePath) {
    const safePath = validateWorkspaceFilePath(relativePath);
    const absolutePath = this.#resolveWorkspacePath(safePath);

    try {
      const content = await fs.readFile(absolutePath, 'utf8');
      const metadata = await this.getFileMetadata(safePath, 'read');
      await this.logger.history('READ_FILE', metadata);
      return { content, metadata };
    } catch (error) {
      throw this.#normalizeFileError(error, safePath, 'read');
    }
  }

  /**
   * Updates an existing file by appending or overwriting content.
   *
   * @param {string} relativePath workspace-relative path
   * @param {string} content content to write
   * @param {'append' | 'overwrite'} mode write mode
   * @returns {Promise<Record<string, unknown>>} file metadata
   */
  async updateFile(relativePath, content, mode = 'append') {
    const safePath = validateWorkspaceFilePath(relativePath);
    const writeMode = validateWriteMode(mode);
    const absolutePath = this.#resolveWorkspacePath(safePath);

    try {
      await this.#assertFileExists(absolutePath, safePath);

      if (writeMode === 'append') {
        await fs.appendFile(absolutePath, content, 'utf8');
      } else {
        await fs.writeFile(absolutePath, content, 'utf8');
      }

      const metadata = await this.getFileMetadata(safePath, 'update');
      await this.logger.history('UPDATE_FILE', { ...metadata, mode: writeMode });
      return metadata;
    } catch (error) {
      throw this.#normalizeFileError(error, safePath, 'update');
    }
  }

  /**
   * Deletes an existing file.
   *
   * @param {string} relativePath workspace-relative path
   * @returns {Promise<Record<string, unknown>>} metadata captured before deletion
   */
  async deleteFile(relativePath) {
    const safePath = validateWorkspaceFilePath(relativePath);
    const absolutePath = this.#resolveWorkspacePath(safePath);

    try {
      const metadata = await this.getFileMetadata(safePath, 'delete');
      await fs.unlink(absolutePath);
      await this.logger.history('DELETE_FILE', metadata);
      return metadata;
    } catch (error) {
      throw this.#normalizeFileError(error, safePath, 'delete');
    }
  }

  /**
   * Returns metadata for a workspace file.
   *
   * @param {string} relativePath workspace-relative path
   * @returns {Promise<Record<string, unknown>>} metadata
   */
  async getFileMetadata(relativePath, operation = 'read') {
    const safePath = validateWorkspaceFilePath(relativePath);
    const absolutePath = this.#resolveWorkspacePath(safePath);

    try {
      const stats = await fs.stat(absolutePath);

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${safePath}`);
      }

      return {
        relativePath: safePath,
        absolutePath,
        sizeBytes: stats.size,
        createdAt: formatTimestamp(stats.birthtime),
        modifiedAt: formatTimestamp(stats.mtime)
      };
    } catch (error) {
      throw this.#normalizeFileError(error, safePath, operation);
    }
  }

  /**
   * Searches readable workspace code files for a case-insensitive keyword.
   *
   * @param {string} keyword text to find
   * @returns {Promise<Array<{ relativePath: string, lineNumber: number }>>} matching lines
   */
  async searchFiles(keyword) {
    const safeKeyword = validateSearchKeyword(keyword);
    const normalizedKeyword = safeKeyword.toLocaleLowerCase();
    await this.initialize();
    const files = (await this.#listFiles(this.workspaceDirectory)).filter(isCodeFilePath);
    const matches = [];

    for (const absolutePath of files) {
      let content;

      try {
        content = await fs.readFile(absolutePath, 'utf8');
      } catch (error) {
        if (['EACCES', 'EPERM', 'ENOENT'].includes(error.code)) {
          continue;
        }
        throw error;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        if (lines[index].toLocaleLowerCase().includes(normalizedKeyword)) {
          matches.push({
            relativePath: path.relative(this.workspaceDirectory, absolutePath),
            lineNumber: index + 1
          });
        }
      }
    }

    return matches;
  }

  /**
   * Computes workspace statistics for reporting.
   *
   * @returns {Promise<Record<string, unknown>>} workspace statistics
   */
  async getWorkspaceStatistics() {
    await this.initialize();

    const files = await this.#listFiles(this.workspaceDirectory);
    const metadata = await Promise.all(
      files.map(async (absolutePath) => {
        const stats = await fs.stat(absolutePath);
        return {
          relativePath: path.relative(this.workspaceDirectory, absolutePath),
          sizeBytes: stats.size,
          createdAt: formatTimestamp(stats.birthtime),
          modifiedAt: formatTimestamp(stats.mtime)
        };
      })
    );

    const totalSizeBytes = metadata.reduce((sum, file) => sum + file.sizeBytes, 0);
    const largestFile = metadata.reduce(
      (largest, file) => (!largest || file.sizeBytes > largest.sizeBytes ? file : largest),
      null
    );
    const mostRecentlyModifiedFile = metadata.reduce(
      (latest, file) => (!latest || file.modifiedAt > latest.modifiedAt ? file : latest),
      null
    );
    const averageFileSizeBytes = metadata.length > 0
      ? Number((totalSizeBytes / metadata.length).toFixed(2))
      : 0;
    const totalCodeFiles = metadata.filter((file) => isCodeFilePath(file.relativePath)).length;

    return {
      workspaceDirectory: this.workspaceDirectory,
      totalFiles: metadata.length,
      totalSizeBytes,
      largestFile,
      insights: {
        mostRecentlyModifiedFile,
        largestFile,
        averageFileSizeBytes,
        totalCodeFiles
      },
      files: metadata
    };
  }

  async #listFiles(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const nestedFiles = await Promise.all(
      entries.map(async (entry) => {
        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          return this.#listFiles(absolutePath);
        }
        if (!entry.isFile()) {
          return [];
        }

        return entry.name === '.operation-history.log' ? [] : [absolutePath];
      })
    );

    return nestedFiles.flat();
  }

  async #assertFileExists(absolutePath, safePath) {
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${safePath}`);
      }
    } catch (error) {
      throw this.#normalizeFileError(error, safePath, 'update');
    }
  }

  #resolveWorkspacePath(relativePath) {
    const absolutePath = path.resolve(this.workspaceDirectory, relativePath);
    const relativeToWorkspace = path.relative(this.workspaceDirectory, absolutePath);

    if (relativeToWorkspace.startsWith('..') || path.isAbsolute(relativeToWorkspace)) {
      throw new Error('Resolved path escapes the workspace directory.');
    }

    return absolutePath;
  }

  #normalizeFileError(error, safePath, operation = 'read') {
    if (error instanceof CliError) {
      return error;
    }

    if (error.code === 'ENOENT') {
      const action = operation === 'delete' ? 'deleted' : operation === 'update' ? 'updated' : 'read';
      const suggestion = operation === 'delete'
        ? 'Check the file name and inspect the workspace before retrying.'
        : 'Create the file first, then retry the operation.';
      const example = operation === 'delete'
        ? 'node src/index.js workspace:stats'
        : `node src/index.js create ${safePath} --content "console.log('hello')"`;
      return new CliError(
        `File Not Found: ${safePath}`,
        `The file cannot be ${action} because it does not exist inside the workspace.`,
        suggestion,
        example
      );
    }

    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return new Error(`Permission denied while accessing: ${safePath}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

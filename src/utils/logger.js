import fs from 'node:fs/promises';
import path from 'node:path';

const LEVELS = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  success: 'SUCCESS'
};

/**
 * Lightweight application logger with console output and persistent operation history.
 */
export class Logger {
  /**
   * @param {{ logFilePath: string }} options logger configuration
   */
  constructor({ logFilePath }) {
    this.logFilePath = logFilePath;
  }

  /**
   * Writes a structured operation entry to the workspace history log.
   *
   * @param {string} action operation name
   * @param {Record<string, unknown>} details operation metadata
   * @returns {Promise<void>}
   */
  async history(action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };

    try {
      await fs.mkdir(path.dirname(this.logFilePath), { recursive: true });
      await fs.appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      this.warn(`Could not write operation history: ${error.message}`);
    }
  }

  /**
   * Logs a normal informational message.
   *
   * @param {string} message message to display
   */
  info(message) {
    this.#write(LEVELS.info, message);
  }

  /**
   * Logs a warning message.
   *
   * @param {string} message message to display
   */
  warn(message) {
    this.#write(LEVELS.warn, message);
  }

  /**
   * Logs an error message.
   *
   * @param {string} message message to display
   */
  error(message) {
    this.#write(LEVELS.error, message);
  }

  /**
   * Logs a success message.
   *
   * @param {string} message message to display
   */
  success(message) {
    this.#write(LEVELS.success, message);
  }

  #write(level, message) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${level}] ${message}`);
  }
}


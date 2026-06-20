/**
 * Converts bytes into a compact human-readable value.
 *
 * @param {number} bytes byte count
 * @returns {string} formatted size
 */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'Not Available';
  }

  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * Converts seconds to a readable uptime string.
 *
 * @param {number} totalSeconds uptime in seconds
 * @returns {string} formatted duration
 */
export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return 'Not Available';
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Formats a timestamp for console output.
 *
 * @param {Date | string | undefined} value date value
 * @returns {string} ISO timestamp or fallback
 */
export function formatTimestamp(value) {
  if (!value) {
    return 'Not Available';
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not Available' : date.toISOString();
}

/**
 * Prints a titled section divider.
 *
 * @param {string} title section title
 */
export function printSection(title) {
  const line = '='.repeat(Math.max(title.length + 8, 48));
  console.log(`\n${line}`);
  console.log(`   ${title}`);
  console.log(line);
}

/**
 * Prints key/value data as a console table.
 *
 * @param {string} title table title
 * @param {Record<string, unknown>} data table data
 */
export function printKeyValueTable(title, data) {
  printSection(title);
  console.table(
    Object.entries(data).map(([field, value]) => ({
      Field: field,
      Value: value ?? 'Not Available'
    }))
  );
}

/**
 * Builds a human-readable system summary.
 *
 * @param {Record<string, unknown>} report collected report
 * @returns {string[]} summary lines
 */
export function buildSummary(report) {
  const { systemInfo, healthSummary, systemHealthScore, workspaceStatistics, workspaceInsights } = report;

  return [
    `Host ${systemInfo.hostname} is running ${systemInfo.osType} ${systemInfo.osRelease} on ${systemInfo.cpuArchitecture}.`,
    `System health score is ${systemHealthScore.score}/100 (${systemHealthScore.category}); memory usage is ${healthSummary.memory.usedPercentage}%.`,
    `Workspace contains ${workspaceInsights.totalCodeFiles} code file(s), using ${formatBytes(workspaceStatistics.totalSizeBytes)}.`
  ];
}

/**
 * Prints a complete professional report to stdout.
 *
 * @param {Record<string, unknown>} report collected report
 */
export function printReport(report) {
  printKeyValueTable('Report Metadata', {
    'Report ID': report.reportMetadata.reportId,
    'Generated Timestamp': report.reportMetadata.generatedTimestamp,
    'CLI Version': report.reportMetadata.cliVersion
  });
  printKeyValueTable('System Information', report.systemInfo);
  printKeyValueTable(
    'Selected Environment Variables',
    Object.fromEntries(
      Object.entries(report.environmentVariables).map(([name, value]) => [name, truncateForConsole(value)])
    )
  );
  console.log('Long values are truncated in console output. JSON export contains full values.');
  printKeyValueTable('System Health Summary', {
    Status: report.healthSummary.status,
    'Memory Status': report.healthSummary.memory.status,
    'Memory Used': `${report.healthSummary.memory.usedPercentage}%`,
    'Free Memory': formatBytes(report.healthSummary.memory.freeBytes),
    Uptime: report.systemInfo.systemUptime
  });
  printKeyValueTable('System Health Score', {
    Score: `${report.systemHealthScore.score}/100`,
    Category: report.systemHealthScore.category,
    'Memory Component': `${report.systemHealthScore.components.memoryScore}/100`,
    'Uptime Component': `${report.systemHealthScore.components.uptimeScore}/100`,
    'Uptime Available': report.systemHealthScore.components.uptimeAvailable ? 'Yes' : 'No - neutral fallback applied'
  });
  printKeyValueTable('Workspace Statistics', {
    'Total Files': report.workspaceStatistics.totalFiles,
    'Total Size': formatBytes(report.workspaceStatistics.totalSizeBytes),
    'Largest File': report.workspaceStatistics.largestFile?.relativePath ?? 'Not Available',
    'Generated At': report.generatedAt
  });
  printKeyValueTable('Workspace Insights', {
    'Most Recently Modified': report.workspaceInsights.mostRecentlyModifiedFile?.relativePath ?? 'Not Available',
    'Largest File': report.workspaceInsights.largestFile?.relativePath ?? 'Not Available',
    'Average File Size': formatBytes(report.workspaceInsights.averageFileSizeBytes),
    'Total Code Files': report.workspaceInsights.totalCodeFiles
  });

  printSection('Human-Readable Summary');
  for (const line of buildSummary(report)) {
    console.log(`- ${line}`);
  }
}

function truncateForConsole(value, maximumLength = 80) {
  const text = String(value ?? 'Not Available');
  const suffix = '... [truncated]';

  if (text.length <= maximumLength) {
    return text;
  }

  return `${text.slice(0, maximumLength - suffix.length)}${suffix}`;
}

/**
 * Prints file metadata in a consistent table.
 *
 * @param {string} title section title
 * @param {Record<string, unknown>} metadata file metadata
 */
export function printFileMetadata(title, metadata) {
  printKeyValueTable(title, {
    Path: metadata.relativePath,
    Size: formatBytes(metadata.sizeBytes),
    Created: metadata.createdAt,
    'Last Modified': metadata.modifiedAt
  });
}

/**
 * Prints a consistent, actionable CLI error block.
 *
 * @param {Error & { title?: string, reason?: string, suggestion?: string, example?: string }} error application error
 */
export function printCliError(error) {
  console.error(`\n[ERROR] ${error.title ?? 'Unexpected Error'}`);
  console.error(`Reason: ${error.reason ?? error.message ?? 'An unexpected runtime error occurred.'}`);
  console.error(`Suggestion: ${error.suggestion ?? 'Review the command arguments and try again.'}`);
  console.error(`Example: ${error.example ?? 'node src/index.js help'}\n`);
}

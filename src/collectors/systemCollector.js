import os from 'node:os';
import { formatBytes, formatDuration } from '../utils/formatter.js';

const SAFE_ENVIRONMENT_VARIABLES = ['PATH', 'HOME', 'USER', 'SHELL', 'TEMP'];

/**
 * Collects operating system, runtime, environment, and health data.
 */
export class SystemCollector {
  /**
   * Collects all supported system intelligence fields.
   *
   * @returns {Record<string, unknown>} system intelligence report fragment
   */
  collect() {
    const totalMemory = safeNumber(() => os.totalmem(), 0);
    const freeMemory = safeNumber(() => os.freemem(), 0);
    const usedMemory = totalMemory - freeMemory;
    const usedPercentage = totalMemory > 0 ? Number(((usedMemory / totalMemory) * 100).toFixed(2)) : 0;
    const cpus = safeValue(() => os.cpus(), []);
    const userInfo = safeValue(() => os.userInfo(), { username: 'Not Available' });
    const uptimeSeconds = safeNumber(() => os.uptime(), -1);

    const systemInfo = {
      osType: safeValue(() => os.type(), 'Not Available'),
      osRelease: safeValue(() => os.release(), 'Not Available'),
      cpuArchitecture: safeValue(() => os.arch(), 'Not Available'),
      cpuCoreCount: cpus?.length ?? 0,
      hostname: safeValue(() => os.hostname(), 'Not Available'),
      nodeVersion: process.version,
      platform: process.platform,
      homeDirectory: safeValue(() => os.homedir(), 'Not Available'),
      currentUser: userInfo.username,
      systemUptime: formatDuration(uptimeSeconds),
      totalMemory: formatBytes(totalMemory),
      freeMemory: formatBytes(freeMemory)
    };

    const environmentVariables = Object.fromEntries(
      SAFE_ENVIRONMENT_VARIABLES.map((name) => [name, process.env[name] || 'Not Available'])
    );

    const healthSummary = {
      status: usedPercentage < 80 ? 'Healthy' : usedPercentage < 92 ? 'Warning' : 'Critical',
      memory: {
        totalBytes: totalMemory,
        freeBytes: freeMemory,
        usedBytes: usedMemory,
        usedPercentage,
        status: usedPercentage < 80 ? 'Healthy' : usedPercentage < 92 ? 'High Usage' : 'Critical Usage'
      },
      cpu: {
        coreCount: systemInfo.cpuCoreCount,
        architecture: systemInfo.cpuArchitecture
      }
    };
    const systemHealthScore = calculateSystemHealthScore(usedPercentage, uptimeSeconds);

    return {
      systemInfo,
      environmentVariables,
      healthSummary,
      systemHealthScore
    };
  }
}

function calculateSystemHealthScore(memoryUsedPercentage, uptimeSeconds) {
  const memoryScore = calculateMemoryScore(memoryUsedPercentage);
  const uptimeScore = calculateUptimeScore(uptimeSeconds);
  const score = Math.round((memoryScore * 0.75) + (uptimeScore * 0.25));

  return {
    score,
    category: getHealthCategory(score),
    components: {
      memoryScore,
      uptimeScore,
      uptimeAvailable: uptimeSeconds >= 0
    }
  };
}

function calculateMemoryScore(usedPercentage) {
  if (usedPercentage <= 60) return 100;
  if (usedPercentage <= 75) return Math.round(100 - ((usedPercentage - 60) * 1.33));
  if (usedPercentage <= 85) return Math.round(80 - ((usedPercentage - 75) * 2));
  if (usedPercentage <= 95) return Math.round(60 - ((usedPercentage - 85) * 3.5));
  return Math.max(0, Math.round(25 - ((usedPercentage - 95) * 5)));
}

function calculateUptimeScore(uptimeSeconds) {
  if (uptimeSeconds < 0) return 70;

  const uptimeDays = uptimeSeconds / 86400;
  if (uptimeDays < 7) return 100;
  if (uptimeDays < 30) return 90;
  if (uptimeDays < 90) return 75;
  if (uptimeDays < 180) return 60;
  return 40;
}

function getHealthCategory(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function safeValue(producer, fallback) {
  try {
    return producer();
  } catch {
    return fallback;
  }
}

function safeNumber(producer, fallback) {
  const value = safeValue(producer, fallback);
  return Number.isFinite(value) ? value : fallback;
}

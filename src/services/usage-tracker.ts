import * as fs from 'fs';
import { CONFIG_PATH, PROJECT_PATH } from '../config';

export interface UsageStats {
  commands: Record<string, number>;
  plugins: Record<string, number>;
  lastUpdated: string;
}

export interface CommandUsage {
  name: string;
  count: number;
  description?: string;
  usage?: string;
}

/**
 * Lightweight usage tracker that stores command/plugin usage counts
 * in the existing config.json file. No record growth - just counters.
 */
export class UsageTracker {
  private stats: UsageStats;
  private dirty: boolean = false;

  constructor() {
    this.stats = this.loadStats();
  }

  private loadStats(): UsageStats {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        if (config.usage) {
          return {
            commands: config.usage.commands || {},
            plugins: config.usage.plugins || {},
            lastUpdated: config.usage.lastUpdated || new Date().toISOString()
          };
        }
      }
    } catch {
      // Ignore errors, return empty stats
    }

    return {
      commands: {},
      plugins: {},
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Track a command execution. Optionally track the plugin it belongs to.
   */
  trackCommand(commandName: string, pluginName?: string): void {
    // Normalize to primary command name (not alias)
    const normalizedCommand = commandName.toLowerCase();

    this.stats.commands[normalizedCommand] = (this.stats.commands[normalizedCommand] || 0) + 1;

    if (pluginName) {
      this.stats.plugins[pluginName] = (this.stats.plugins[pluginName] || 0) + 1;
    }

    this.stats.lastUpdated = new Date().toISOString();
    this.dirty = true;
  }

  /**
   * Get top N most used commands
   */
  getTopCommands(limit: number = 5): CommandUsage[] {
    return Object.entries(this.stats.commands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Get top N most used plugins
   */
  getTopPlugins(limit: number = 5): { name: string; count: number }[] {
    return Object.entries(this.stats.plugins)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  /**
   * Get total number of tracked commands
   */
  getTotalCommands(): number {
    return Object.keys(this.stats.commands).length;
  }

  /**
   * Get total usage count across all commands
   */
  getTotalUsage(): number {
    return Object.values(this.stats.commands).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Check if we have enough usage data to show recommendations
   */
  hasEnoughData(minCommands: number = 3, minTotalUsage: number = 5): boolean {
    return this.getTotalCommands() >= minCommands && this.getTotalUsage() >= minTotalUsage;
  }

  /**
   * Save stats to config file. Called automatically on process exit
   * or can be called manually.
   */
  save(): void {
    if (!this.dirty) return;

    try {
      fs.mkdirSync(PROJECT_PATH, { recursive: true });

      let config: Record<string, any> = {};

      if (fs.existsSync(CONFIG_PATH)) {
        config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      }

      config.usage = this.stats;

      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      this.dirty = false;
    } catch (error) {
      // Silently fail - don't break CLI for usage tracking
    }
  }

  /**
   * Reset all usage stats
   */
  reset(): void {
    this.stats = {
      commands: {},
      plugins: {},
      lastUpdated: new Date().toISOString()
    };
    this.dirty = true;
    this.save();
  }
}

// Singleton instance
let instance: UsageTracker | null = null;

export function getUsageTracker(): UsageTracker {
  if (!instance) {
    instance = new UsageTracker();

    // Auto-save on process exit
    process.on('exit', () => {
      instance?.save();
    });

    // Handle SIGINT/SIGTERM gracefully
    process.on('SIGINT', () => {
      instance?.save();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      instance?.save();
      process.exit(0);
    });
  }

  return instance;
}

import * as fs from 'fs';
import * as path from 'path';
import { LOGS_PATH } from '../config';
import type { CommandGuardResult } from '../types';

export class CommandGuard {
  private static readonly DANGEROUS_PATTERNS = [
    // Filesystem destruction - Enhanced patterns
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+(?:.*\s+)?-rf\s+\/(?:\s|$)/, reason: 'Attempting to delete root filesystem' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+(?:.*\s+)?-rf\s+\/\*/, reason: 'Attempting to delete all files in root' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+(?:.*\s+)?-rf\s+~\/\*/, reason: 'Attempting to delete all files in home directory' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+.*--no-preserve-root.*\/(?:\s|$)/, reason: 'Root deletion with no-preserve-root flag' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+(?:.*\s+)?-rf\s+\/(?:etc|var|usr|bin|sbin|lib|boot|dev|sys|proc)(?:\s|\/|$)/i, reason: 'Attempting to delete critical system directory' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+(?:.*\s+)?-rf\s+\/data\//, reason: 'Attempting to delete data directory' },
    
    // Disk operations
    { pattern: /dd\s+.*of=\/dev\/[sh]d[a-z](?:\d|$)/, reason: 'Direct disk write operations are dangerous' },
    { pattern: /mkfs\.[a-z0-9]+\s+\/dev\//, reason: 'Filesystem formatting commands are dangerous' },
    { pattern: />\s*\/dev\/[sh]d[a-z]/, reason: 'Direct disk write operations are dangerous' },
    { pattern: /fdisk\s+\/dev\//, reason: 'Disk partitioning commands are dangerous' },
    { pattern: /parted\s+.*\/dev\//, reason: 'Disk partitioning commands are dangerous' },
    
    // Docker destruction
    { pattern: /docker\s+system\s+prune.*(?:-a|--all).*(?:--volumes|-v)/, reason: 'Mass Docker cleanup with volumes is dangerous' },
    { pattern: /docker\s+system\s+prune.*(?:--volumes|-v).*(?:-a|--all)/, reason: 'Mass Docker cleanup with volumes is dangerous' },
    { pattern: /docker\s+volume\s+prune.*(?:-f|--force)/, reason: 'Forced Docker volume deletion is dangerous' },
    { pattern: /docker\s+compose\s+down.*--volumes/, reason: 'Docker compose with volume deletion is dangerous' },
    { pattern: /docker-compose\s+down.*--volumes/, reason: 'Docker compose with volume deletion is dangerous' },
    
    // Service disruption
    { pattern: /(?:^|\s)(?:sudo\s+)?systemctl\s+(?:stop|disable|mask)\s+(?:docker|ssh|sshd|vssh)(?:\s|$)/, reason: 'Stopping critical services is dangerous' },
    { pattern: /(?:^|\s)(?:sudo\s+)?service\s+(?:docker|ssh|sshd|vssh)\s+(?:stop|disable)/, reason: 'Stopping critical services is dangerous' },
    
    // Network disruption
    { pattern: /iptables\s+-F/, reason: 'Flushing firewall rules is dangerous' },
    { pattern: /iptables\s+--flush/, reason: 'Flushing firewall rules is dangerous' },
    { pattern: /ufw\s+(?:disable|--force\s+reset)/, reason: 'Disabling firewall is dangerous' },
    
    // System files
    { pattern: />\s*\/etc\/(?:passwd|shadow|group|sudoers)/, reason: 'Overwriting critical system files' },
    { pattern: /(?:^|\s)(?:sudo\s+)?rm\s+.*\/etc\/(?:passwd|shadow|group|sudoers)/, reason: 'Deleting critical system files' },
    { pattern: /(?:^|\s)(?:sudo\s+)?truncate\s+.*\/etc\/(?:passwd|shadow|group|sudoers)/, reason: 'Truncating critical system files' },
    
    // System shutdown/reboot
    { pattern: /(?:^|\s)(?:sudo\s+)?(?:shutdown|poweroff|halt|reboot|init\s+0|init\s+6)(?:\s|$)/, reason: 'System shutdown/reboot commands are dangerous' },
    
    // Permissions
    { pattern: /chmod\s+(?:-R\s+)?777\s+\//, reason: 'Making entire filesystem world-writable' },
    { pattern: /chown\s+(?:-R\s+)?.*:.*\s+\/(?:\s|$)/, reason: 'Changing ownership of entire filesystem' },
    
    // Fork bombs and malicious patterns
    { pattern: /:\s*\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;?\s*:/, reason: 'Fork bomb detected' },
    { pattern: /\$\(.*\)\s*{\s*\$\(.*\)\|.*&\s*}/, reason: 'Potential fork bomb pattern' },
  ];

  private static readonly SUSPICIOUS_PATTERNS = [
    { pattern: /curl\s+.*\|\s*(?:bash|sh)/, reason: 'Downloading and executing scripts directly' },
    { pattern: /wget\s+.*\|\s*(?:bash|sh)/, reason: 'Downloading and executing scripts directly' },
    { pattern: /eval\s+.*curl/, reason: 'Evaluating downloaded content' },
    { pattern: /eval\s+.*wget/, reason: 'Evaluating downloaded content' },
  ];

  static checkCommand(command: string): CommandGuardResult {
    const reasons: string[] = [];
    let rule: string | undefined;

    // Check dangerous patterns
    for (const { pattern, reason } of this.DANGEROUS_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push(reason);
        rule = pattern.toString();
        break;
      }
    }

    // Check suspicious patterns
    for (const { pattern, reason } of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(command)) {
        reasons.push(`⚠️  WARNING: ${reason}`);
        if (!rule) rule = pattern.toString();
      }
    }

    return {
      isBlocked: reasons.length > 0 && !reasons[0].startsWith('⚠️'),
      reasons,
      rule
    };
  }

  static displayBlockedMessage(command: string, result: CommandGuardResult): void {
    console.error('\n🚫 COMMAND BLOCKED FOR SAFETY REASONS\n');
    console.error(`Command: ${command}`);
    console.error(`Reason: ${result.reasons[0]}`);
    console.error('\nThis command has been blocked to prevent potential system damage.');
    console.error('If you believe this is a false positive, please review the command carefully.\n');
  }

  static logBlockedCommand(command: string, result: CommandGuardResult): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] BLOCKED: ${command}\nReason: ${result.reasons.join(', ')}\nRule: ${result.rule}\n${'='.repeat(80)}\n`;
    
    const logPath = path.join(LOGS_PATH, 'blocked_commands.log');
    fs.appendFileSync(logPath, logEntry);
  }
}
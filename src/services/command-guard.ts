import type { CommandGuardResult } from '../types';

interface GuardPattern {
  pattern: RegExp;
  reason: string;
}

const DANGEROUS_PATTERNS: GuardPattern[] = [
  {
    pattern: /(?:^|[;&|]\s*|\s)(?:sudo(?:\s+-\S+)*\s+)?(?:command\s+)?(?:\/\S*\/)?rm\s+(?=[^;&|\n]*(?:--recursive|-[A-Za-z]*[rR]))(?=[^;&|\n]*(?:--force|-[A-Za-z]*f))[^;&|\n]*\s(?:['"]?\/(?:['"]?(?:\s|$)|\*|\{)|['"]?~\/?\*)/,
    reason: 'Attempting broad deletion of the root or home filesystem',
  },
  {
    pattern: /(?:^|[;&|]\s*|\s)(?:sudo(?:\s+-\S+)*\s+)?(?:\/\S*\/)?rm\s+[^;&|\n]*(?:--recursive|-[A-Za-z]*[rR])[^;&|\n]*\s['"]?\/(?:etc|var|usr|bin|sbin|lib|boot|dev|sys|proc)(?:['"/\s]|$)/,
    reason: 'Attempting to delete a critical system directory',
  },
  { pattern: /\bdd\s+[^;&|\n]*\bof=\/dev\/(?:sd|hd|vd|nvme)\S*/, reason: 'Direct disk writes are dangerous' },
  { pattern: /\bmkfs(?:\.\w+)?\s+[^;&|\n]*\/dev\//, reason: 'Filesystem formatting is dangerous' },
  { pattern: /(?:>|\btee\s+)\s*\/dev\/(?:sd|hd|vd|nvme)\S*/, reason: 'Direct disk writes are dangerous' },
  { pattern: /\b(?:fdisk|parted)\s+[^;&|\n]*\/dev\//, reason: 'Disk partitioning is dangerous' },
  { pattern: /\bdocker\s+system\s+prune\b(?=[^\n]*(?:-a|--all))(?=[^\n]*(?:--volumes|-v))/, reason: 'Mass Docker cleanup with volumes is dangerous' },
  { pattern: /\bdocker\s+volume\s+prune\b[^\n]*(?:-f|--force)/, reason: 'Forced Docker volume deletion is dangerous' },
  { pattern: /\bdocker(?:-compose|\s+compose)\s+down\b[^\n]*(?:--volumes|-v)/, reason: 'Docker Compose volume deletion is dangerous' },
  { pattern: /\bsystemctl\s+(?:stop|disable|mask)\s+(?:docker|ssh|sshd)\b/, reason: 'Stopping critical services is dangerous' },
  { pattern: /\bservice\s+(?:docker|ssh|sshd)\s+(?:stop|disable)\b/, reason: 'Stopping critical services is dangerous' },
  { pattern: /\biptables\s+(?:-F|--flush)\b/, reason: 'Flushing firewall rules is dangerous' },
  { pattern: /\bufw\s+(?:disable|--force\s+reset)\b/, reason: 'Disabling the firewall is dangerous' },
  { pattern: /(?:>|\btee\s+)\s*\/etc\/(?:passwd|shadow|group|sudoers)\b/, reason: 'Overwriting critical account files is dangerous' },
  { pattern: /\b(?:shutdown|poweroff|halt|reboot)\b|\binit\s+[06]\b/, reason: 'System shutdown or reboot is dangerous' },
  { pattern: /\bchmod\s+(?:-R\s+)?777\s+\/(?:\s|$)/, reason: 'Making the root filesystem world-writable is dangerous' },
  { pattern: /:\s*\(\)\s*{\s*:\s*\|\s*:\s*&\s*}\s*;?\s*:/, reason: 'Fork bomb detected' },
];

const WARNING_PATTERNS: GuardPattern[] = [
  { pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:bash|sh)\b/, reason: 'Downloading and executing a script directly' },
  { pattern: /\beval\b[^\n]*(?:curl|wget)\b/, reason: 'Evaluating downloaded content' },
];

export class CommandGuard {
  static checkCommand(command: string): CommandGuardResult {
    for (const guard of DANGEROUS_PATTERNS) {
      if (guard.pattern.test(command)) {
        return { isBlocked: true, reasons: [guard.reason], rule: guard.pattern.source };
      }
    }

    const warnings = WARNING_PATTERNS
      .filter((guard) => guard.pattern.test(command))
      .map((guard) => `WARNING: ${guard.reason}`);

    return {
      isBlocked: false,
      reasons: warnings,
      ...(warnings.length > 0 && { rule: 'warning' }),
    };
  }
}

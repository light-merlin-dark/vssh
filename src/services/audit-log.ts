import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { LOGS_PATH } from '../config';

export interface AuditEvent {
  command: string;
  transport: 'ssh' | 'local' | 'scp';
  exitCode: number;
  durationMs: number;
  blocked?: boolean;
  timedOut?: boolean;
  /** Set when --allow-guard let a blocked command run: which rule, and the operator's reason. */
  guardOverride?: { rule: string; reason: string };
}

export function writeAuditEvent(event: AuditEvent): void {
  fs.mkdirSync(LOGS_PATH, { recursive: true, mode: 0o700 });
  const logPath = path.join(LOGS_PATH, 'commands.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    transport: event.transport,
    commandHash: crypto.createHash('sha256').update(event.command).digest('hex'),
    commandBytes: Buffer.byteLength(event.command),
    exitCode: event.exitCode,
    durationMs: event.durationMs,
    ...(event.blocked && { blocked: true }),
    ...(event.timedOut && { timedOut: true }),
    ...(event.guardOverride && {
      guardOverridden: true,
      guardRule: event.guardOverride.rule.slice(0, 200),
      overrideReason: event.guardOverride.reason.slice(0, 200),
    }),
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  try {
    fs.chmodSync(logPath, 0o600);
  } catch {
    // Existing files on unusual filesystems may not support chmod.
  }
}

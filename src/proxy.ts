import { SSHService } from './services/ssh';
import { CommandGuardService } from './services/command-guard-service';
import { Config, LOGS_PATH } from './config';
import * as fs from 'fs';
import * as path from 'path';

export async function executeProxy(args: string[], config: Config, commandGuard?: CommandGuardService) {
  const command = args.join(' ');
  
  // Check command safety
  const guard = commandGuard || new CommandGuardService();
  const guardResult = guard.checkCommand(command);
  
  // Display warnings, if any
  if (guardResult.reasons.length > 0) {
    guardResult.reasons.forEach(reason => {
      if (reason.startsWith('⚠️')) {
        console.warn(reason);
      }
    });
  }
  
  if (guardResult.isBlocked) {
    guard.displayBlockedMessage(command, guardResult);
    guard.logBlockedCommand(command, guardResult);
    process.exit(1);
  }

  // Log command
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] COMMAND: ${command}\n`;
  fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), logEntry);
  
  // Execute via SSH
  const ssh = new SSHService(config);
  const startTime = Date.now();
  const result = await ssh.executeCommand(command);
  const duration = Date.now() - startTime;
  
  // Log result
  const resultLog = `[${timestamp}] RESULT [${duration}ms]:\n${result}\n${'='.repeat(80)}\n`;
  fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), resultLog);
  
  // Output result (SSH-compatible - no emoji prefixes)
  if (result.trim()) {
    console.log(result);
  }
}
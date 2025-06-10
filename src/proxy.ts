import { SSHService } from './services/ssh';
import { CommandGuard } from './services/command-guard';
import { loadConfig, LOGS_PATH } from './config';
import * as fs from 'fs';
import * as path from 'path';

export async function executeProxy(args: string[]) {
  const command = args.join(' ');

  // Check command safety
  const guardResult = CommandGuard.checkCommand(command);
  
  // Display warnings, if any
  if (guardResult.reasons.length > 0) {
    guardResult.reasons.forEach(reason => {
      if (reason.startsWith('⚠️')) {
        console.warn(reason);
      }
    });
  }
  
  if (guardResult.isBlocked) {
    CommandGuard.displayBlockedMessage(command, guardResult);
    CommandGuard.logBlockedCommand(command, guardResult);
    process.exit(1);
  }

  // Log command
  const timestamp = new Date().toISOString();
  console.log(`🚀 Executing: ${command}`);

  const logEntry = `[${timestamp}] COMMAND: ${command}\n`;
  fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), logEntry);

  // Execute via SSH
  const config = loadConfig();
  if (!config) {
    console.error('❌ No SSH configuration found');
    process.exit(1);
  }
  const ssh = new SSHService(config);

  const startTime = Date.now();
  const result = await ssh.executeCommand(command);
  const duration = Date.now() - startTime;

  // Log result
  const resultLog = `[${timestamp}] RESULT [${duration}ms]:\n${result}\n${'='.repeat(80)}\n`;
  fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), resultLog);

  // Output result
  if (result.trim()) {
    console.log(result);
  }
  console.log(`✅ Completed in ${duration}ms`);
}
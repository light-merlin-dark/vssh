import { SSHService } from './services/ssh';
import { CommandGuardService } from './services/command-guard-service';
import { ProxyService } from './services/proxy-service';
import { Config, LOGS_PATH } from './config';
import * as fs from 'fs';
import * as path from 'path';

export async function executeProxy(args: string[], config: Config, commandGuard?: CommandGuardService) {
  // Route through modern ProxyService
  const sshService = new SSHService(config);
  const guard = commandGuard || new CommandGuardService();
  const proxyService = new ProxyService(config, sshService, guard);
  
  const command = args.join(' ');
  const result = await proxyService.executeCommand(command);
  
  // Return structured result for JSON mode compatibility
  return result;
}
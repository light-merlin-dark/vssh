import { SSHService } from './ssh';
import { CommandGuardService } from './command-guard-service';
import { Config, LOGS_PATH } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export interface ProxyOptions {
  skipGuard?: boolean;
  skipLogging?: boolean;
  workingDirectory?: string;
}

export interface CommandResult {
  output: string;
  duration: number;
  timestamp: string;
  command: string;
}

export class ProxyService {
  private sshService: SSHService;
  private commandGuard: CommandGuardService;
  private config: Config;
  private isLocal: boolean = false;

  constructor(config: Config, sshService: SSHService, commandGuard: CommandGuardService) {
    this.config = config;
    this.sshService = sshService;
    this.commandGuard = commandGuard;
  }

  setLocalMode(local: boolean): void {
    this.isLocal = local;
  }

  isLocalMode(): boolean {
    return this.isLocal;
  }

  async executeCommand(command: string, options: ProxyOptions = {}): Promise<CommandResult> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    // Check command safety unless explicitly skipped
    if (!options.skipGuard) {
      const guardResult = this.commandGuard.checkCommand(command);
      
      // Display warnings
      if (guardResult.reasons.length > 0) {
        guardResult.reasons.forEach(reason => {
          if (reason.startsWith('⚠️')) {
            console.warn(reason);
          }
        });
      }
      
      if (guardResult.isBlocked) {
        this.commandGuard.displayBlockedMessage(command, guardResult);
        this.commandGuard.logBlockedCommand(command, guardResult);
        throw new Error(`Command blocked: ${guardResult.reasons.join(', ')}`);
      }
    }

    // Log command start
    if (!options.skipLogging) {
      console.log(`🚀 Executing${this.isLocal ? ' locally' : ''}: ${command}`);
      const logEntry = `[${timestamp}] ${this.isLocal ? 'LOCAL' : 'REMOTE'} COMMAND: ${command}\n`;
      this.ensureLogsDirectory();
      fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), logEntry);
    }

    let output: string;
    
    try {
      if (this.isLocal) {
        // Execute locally using child_process
        const { execSync } = await import('child_process');
        output = execSync(command, {
          encoding: 'utf8',
          cwd: options.workingDirectory,
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
      } else {
        // Execute via SSH
        output = await this.sshService.executeCommand(command);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Log error
      if (!options.skipLogging) {
        const errorLog = `[${timestamp}] ERROR [${duration}ms]: ${error.message}\n${'='.repeat(80)}\n`;
        fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), errorLog);
      }
      
      throw error;
    }

    const duration = Date.now() - startTime;

    // Log result
    if (!options.skipLogging) {
      const resultLog = `[${timestamp}] RESULT [${duration}ms]:\n${output}\n${'='.repeat(80)}\n`;
      fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), resultLog);
      console.log(`✅ Completed in ${duration}ms`);
    }

    return {
      output,
      duration,
      timestamp,
      command
    };
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(LOGS_PATH)) {
      fs.mkdirSync(LOGS_PATH, { recursive: true });
    }
  }
}
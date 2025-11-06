import { SSHService } from './ssh';
import { CommandGuardService } from './command-guard-service';
import { Config, LOGS_PATH } from '../config';
import * as fs from 'fs';
import * as path from 'path';

export interface ProxyOptions {
  skipGuard?: boolean;
  skipLogging?: boolean;
  workingDirectory?: string;
  outputMode?: 'raw' | 'quiet' | 'json';
  jsonFields?: string[];
}

export interface CommandResult {
  output: string;
  duration: number;
  timestamp: string;
  command: string;
  isLocal?: boolean;
  exitCode?: number;
}

export interface JSONResponse {
  success: boolean;
  command: string;
  duration: number;
  timestamp: string;
  output?: string;
  error?: string;
  metadata?: {
    exitCode?: number;
    signal?: string;
    isLocal?: boolean;
  };
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
    const outputMode = options.outputMode || 'raw';

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

    // Log command start (to file only, no console output for SSH purity)
    if (!options.skipLogging) {
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

    // Log result (to file only, no console output for SSH purity)
    if (!options.skipLogging) {
      const resultLog = `[${timestamp}] RESULT [${duration}ms]:\n${output}\n${'='.repeat(80)}\n`;
      fs.appendFileSync(path.join(LOGS_PATH, 'proxy_commands.log'), resultLog);
    }

    return {
      output,
      duration,
      timestamp,
      command,
      isLocal: this.isLocal,
      exitCode: 0
    };
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(LOGS_PATH)) {
      fs.mkdirSync(LOGS_PATH, { recursive: true });
    }
  }

  formatJSONResponse(result: CommandResult, error?: Error): string {
    const response: JSONResponse = {
      success: !error,
      command: result.command,
      duration: result.duration,
      timestamp: result.timestamp,
      output: result.output,
      error: error?.message,
      metadata: {
        isLocal: result.isLocal,
        exitCode: error ? 1 : result.exitCode || 0
      }
    };

    // Apply field filtering if specified
    if (this.jsonFields && this.jsonFields.length > 0) {
      const filteredResponse: any = {};
      this.jsonFields.forEach(field => {
        if (field in response) {
          filteredResponse[field] = (response as any)[field];
        }
        if (field === 'metadata' && response.metadata) {
          filteredResponse.metadata = response.metadata;
        }
      });
      return JSON.stringify(filteredResponse, null, 2);
    }

    return JSON.stringify(response, null, 2);
  }

  private jsonFields?: string[];
  setJSONFields(fields: string[]): void {
    this.jsonFields = fields;
  }
}
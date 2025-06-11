import { SSHService } from '../services/ssh';
import { CommandGuardService } from '../services/command-guard-service';
import { ProxyService } from '../services/proxy-service';

export interface VsshConfig {
  host: string;
  user: string;
  keyPath: string;
  localMode?: boolean;
  plugins?: {
    enabled?: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };
}

export interface PluginContext {
  sshService: SSHService;
  commandGuard: CommandGuardService;
  config: VsshConfig;
  logger: Logger;
  proxyService: ProxyService;
  isLocalExecution: boolean;
  getPlugin(name: string): VsshPlugin | undefined;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

export type CommandHandler = (
  context: PluginContext,
  args: ParsedArgs
) => Promise<void>;

export interface ParsedArgs {
  _: string[];
  [key: string]: any;
}

export interface PluginCommand {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  examples?: string[];
  handler: CommandHandler;
  mcpName?: string;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface CommandGuardExtension {
  category: string;
  patterns: RegExp[];
  message: string;
  suggestion?: string;
}

export interface VsshPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  
  dependencies?: string[];
  
  onLoad?(context: PluginContext): Promise<void>;
  onUnload?(): Promise<void>;
  
  commands: PluginCommand[];
  mcpTools?: McpToolDefinition[];
  commandGuards?: CommandGuardExtension[];
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  enabled: boolean;
  dependencies: string[];
}
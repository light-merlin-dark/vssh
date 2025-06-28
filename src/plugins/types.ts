import { SSHService } from '../services/ssh';
import { CommandGuardService } from '../services/command-guard-service';
import { ProxyService } from '../services/proxy-service';
import { z } from 'zod';

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
  inputSchema?: z.ZodSchema<any>;
  outputSchema?: z.ZodSchema<any>;
  deprecated?: boolean;
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

export interface RuntimeDependency {
  command: string;
  displayName: string;
  checkCommand?: string;
  installHint?: string;
  optional?: boolean;
}

export interface McpCommandExample {
  command: string;
  description: string;
}

export interface McpContextContribution {
  section: string;
  commands: McpCommandExample[];
}

export interface VsshPlugin {
  name: string;
  version: string;
  description: string;
  author?: string;
  
  dependencies?: string[];
  runtimeDependencies?: RuntimeDependency[];
  
  onLoad?(context: PluginContext): Promise<void>;
  onUnload?(): Promise<void>;
  
  commands: PluginCommand[];
  mcpTools?: McpToolDefinition[];
  commandGuards?: CommandGuardExtension[];
  mcpContext?: McpContextContribution;
  configSchema?: z.ZodSchema<any>;
}

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  enabled: boolean;
  dependencies: string[];
}

// Standard response format
export const StandardResponseSchema = z.object({
  status: z.enum(['success', 'error', 'warning']),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional()
  }).optional(),
  metadata: z.object({
    timestamp: z.string(),
    duration: z.number(),
    plugin: z.string(),
    command: z.string()
  })
});

export type StandardResponse = z.infer<typeof StandardResponseSchema>;

// MCP Response type
export interface McpResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  annotations?: Record<string, any>;
}
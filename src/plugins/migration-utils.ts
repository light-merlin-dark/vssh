import { PluginCommand, CommandHandler, McpResponse } from './types';
import { formatResponse, convertLegacyResponse } from './response-utils';

/**
 * Environment variable to enable new response format
 */
const USE_NEW_FORMAT = process.env.VSSH_NEW_RESPONSE_FORMAT === 'true';

/**
 * Wraps a command handler to support both old console output and new structured responses
 */
export function createCompatibleHandler(
  oldHandler: CommandHandler,
  newHandler?: (context: any, args: any) => Promise<McpResponse>
): CommandHandler {
  return async (context, args) => {
    // If new format is enabled and we have a new handler, use it
    if (USE_NEW_FORMAT && newHandler) {
      const response = await newHandler(context, args);
      // For MCP mode, return the structured response as any to bypass type checking
      if ((context as any).isMcpMode) {
        return response as any;
      }
      // For CLI mode, print the formatted output
      console.log(JSON.stringify(JSON.parse(response.content[0].text), null, 2));
      return;
    }
    
    // Otherwise use the old handler
    return oldHandler(context, args);
  };
}

/**
 * Creates a deprecation warning wrapper for commands
 */
export function deprecateCommand(
  command: PluginCommand,
  message: string
): PluginCommand {
  const originalHandler = command.handler;
  
  return {
    ...command,
    deprecated: true,
    handler: async (context, args) => {
      context.logger.warn(`⚠️  ${message}`);
      return originalHandler(context, args);
    }
  };
}

/**
 * Helper to check if we're in MCP mode
 */
export function isMcpMode(context: any): boolean {
  return context.isMcpMode === true;
}

/**
 * Logs migration progress
 */
export function logMigration(pluginName: string, message: string): void {
  if (process.env.VSSH_DEBUG_MIGRATION === 'true') {
    console.error(`[MIGRATION:${pluginName}] ${message}`);
  }
}
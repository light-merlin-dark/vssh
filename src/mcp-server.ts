#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { SSHService } from "./services/ssh";
import { CommandGuardService } from "./services/command-guard-service";
import { loadConfig, setupInteractiveConfig, Config } from "./config";
import { PluginRegistry, PluginLoader } from "./plugins";
import dockerPlugin from "./plugins/builtin/docker";
import coolifyPlugin from "./plugins/builtin/coolify";

// 1. Boot the CLI in "server mode"
const server = new McpServer({
  name: "vssh",
  version: "1.3.0",
  description:
    "AI-friendly SSH proxy with plugin support and safety guard (MCP tool)"
});

// Initialize plugin system
let registry: PluginRegistry | null = null;
let commandGuard: CommandGuardService | null = null;

async function initializePlugins(config: Config) {
  const logger = {
    info: (msg: string) => console.error(`[INFO] ${msg}`),
    warn: (msg: string) => console.error(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
    debug: (msg: string) => console.error(`[DEBUG] ${msg}`)
  };
  
  const sshService = new SSHService(config);
  commandGuard = new CommandGuardService();
  registry = new PluginRegistry(sshService, commandGuard, config, logger);
  
  // Load built-in plugins
  await registry.loadPlugin(dockerPlugin);
  await registry.loadPlugin(coolifyPlugin);
  
  // Apply command guard extensions
  commandGuard.addExtensions(registry.getCommandGuardExtensions());
  
  // Register plugin tools with MCP
  for (const plugin of registry.getEnabledPlugins()) {
    for (const command of plugin.commands) {
      if (command.mcpName) {
        // Register tool with MCP server
        server.tool(
          command.mcpName,
          {
            args: z.array(z.string()).optional().describe("Command arguments")
          },
          async ({ args = [] }) => {
            const parsedArgs = {
              _: [command.name, ...args],
              ...parseFlags(args)
            };
            
            try {
              // Create a string buffer to capture output
              let output = '';
              const captureLogger = {
                ...logger,
                info: (msg: string) => { output += msg + '\n'; },
                warn: (msg: string) => { output += msg + '\n'; },
                error: (msg: string) => { output += msg + '\n'; },
                debug: (msg: string) => { output += msg + '\n'; }
              };
              
              // Override console.log to capture output
              const originalLog = console.log;
              const originalError = console.error;
              console.log = (...args: any[]) => { output += args.join(' ') + '\n'; };
              console.error = (...args: any[]) => { output += args.join(' ') + '\n'; };
              
              const context = {
                sshService,
                commandGuard: commandGuard!,
                config,
                logger: captureLogger,
                getPlugin: (name: string) => registry!.getPlugin(name)
              };
              
              await command.handler(context, parsedArgs);
              
              // Restore console
              console.log = originalLog;
              console.error = originalError;
              
              return {
                content: [{
                  type: "text",
                  text: output.trim() || "Command completed successfully"
                }]
              };
            } catch (error: any) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: `Plugin command error: ${error.message}`
                }]
              };
            }
          }
        );
      }
    }
  }
}

function parseFlags(args: string[]): Record<string, any> {
  const flags: Record<string, any> = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  
  return flags;
}

// 2. === TOOLS ================================================================
/** Tool: run_command – execute a *single* shell command on the remote host */
server.tool(
  "run_command",
  {
    /** Full shell command *exactly* as it would be typed in a terminal */
    command: z.string().min(1, "command is required")
  },
  async ({ command }) => {
    // Initialize plugins if not already done
    if (!registry || !commandGuard) {
      let cfg = loadConfig();
      if (!cfg) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: "No SSH configuration found. Please run 'vssh --setup' first."
          }]
        };
      }
      await initializePlugins(cfg);
    }
    
    // Guard rails
    const guard = commandGuard!.checkCommand(command);
    
    // Collect any warnings
    const warnings = guard.reasons.filter(reason => reason.startsWith('⚠️'));
    
    if (guard.isBlocked)
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              `Command blocked – ${guard.reasons.join(", ")}` +
              `\nRule: ${guard.rule}`
          }
        ]
      };

    // Config (load or interactive first-run)
    let cfg = loadConfig();
    if (!cfg) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "No SSH configuration found. Please run 'vssh --setup' first."
          }
        ]
      };
    }

    const ssh = new SSHService(cfg);
    const start = Date.now();
    
    try {
      const output = await ssh.executeCommand(command);
      const responseText = warnings.length > 0 
        ? `${warnings.join('\n')}\n\n${output.trim() || "(no stdout/stderr)"}`
        : output.trim() || "(no stdout/stderr)";
        
      return {
        content: [
          {
            type: "text",
            text: responseText
          }
        ],
        annotations: {
          durationMs: Date.now() - start,
          ...(warnings.length > 0 && { warnings: warnings.length })
        }
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `SSH execution error: ${error.message}`
          }
        ],
        annotations: {
          durationMs: Date.now() - start
        }
      };
    }
  }
);

// 3. Start the server over stdio (Claude's recommended default)
async function main() {
  // Load config and initialize plugins
  const cfg = loadConfig();
  if (cfg) {
    await initializePlugins(cfg);
  }
  
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("MCP Server error:", error);
  process.exit(1);
});
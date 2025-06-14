#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs";

import { SSHService } from "./services/ssh";
import { CommandGuardService } from "./services/command-guard-service";
import { ProxyService } from "./services/proxy-service";
import { loadConfig, setupInteractiveConfig, Config, CONFIG_PATH } from "./config";
import { PluginRegistry, PluginLoader } from "./plugins";
import dockerPlugin from "./plugins/builtin/docker";
import coolifyPlugin from "./plugins/builtin/coolify";
import proxyPlugin from "./plugins/builtin/proxy";
import grafanaPlugin from "./plugins/builtin/grafana";
import fileEditorPlugin from "./plugins/builtin/file-editor";

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

// Build dynamic MCP description from enabled plugins
function buildRunCommandDescription(): string {
  let description = `SSH command to execute. Examples:

BASIC USAGE:
• vssh ls -la                    # Simple command
• vssh "docker ps -a"            # Command with args  
• vssh 'ps aux | grep node'      # Pipes (use single quotes)

CORE COMMANDS:
• vssh --help                    # Show help
• vssh local-mode on             # Enable local execution
• vssh local-mode off            # Disable local execution`;

  if (registry) {
    const enabledPlugins = registry.getEnabledPlugins();
    
    for (const plugin of enabledPlugins) {
      if (plugin.mcpContext && plugin.mcpContext.commands.length > 0) {
        description += `\n\n${plugin.mcpContext.section}:`;
        
        for (const cmd of plugin.mcpContext.commands) {
          description += `\n• ${cmd.command.padEnd(28)} # ${cmd.description}`;
        }
      }
    }
  }

  description += `\n\nDangerous commands are automatically blocked for safety.`;
  
  return description;
}

async function initializePlugins(config: Config) {
  const logger = {
    info: (msg: string) => console.error(`[INFO] ${msg}`),
    warn: (msg: string) => console.error(`[WARN] ${msg}`),
    error: (msg: string) => console.error(`[ERROR] ${msg}`),
    debug: (msg: string) => console.error(`[DEBUG] ${msg}`)
  };
  
  const sshService = new SSHService(config);
  commandGuard = new CommandGuardService();
  const proxyService = new ProxyService(config, sshService, commandGuard);
  registry = new PluginRegistry(sshService, commandGuard, config, logger, proxyService, false);
  
  // Load built-in plugins
  await registry.loadPlugin(proxyPlugin);
  await registry.loadPlugin(dockerPlugin);
  await registry.loadPlugin(coolifyPlugin);
  await registry.loadPlugin(grafanaPlugin);
  await registry.loadPlugin(fileEditorPlugin);
  
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
            args: z.array(z.string()).default([]).describe("Command arguments")
          },
          async ({ args = [] }) => {
            const positional = [...args];   // 1️⃣ safe clone
            
            const parsedArgs = {
              _: [command.name, ...positional],
              ...parseFlags(positional)     // 2️⃣ mutate the clone, not the original
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
                proxyService: registry!.context.proxyService,
                isLocalExecution: registry!.context.isLocalExecution,
                getPlugin: (name: string) => registry!.getPlugin(name)
              };
              
              await command.handler(context, parsedArgs);
              
              // Restore console
              console.log = originalLog;
              console.error = originalError;
              
              return {
                content: [{
                  type: "text" as const,
                  text: output.trim() || "Command completed successfully"
                }]
              };
            } catch (error: any) {
              return {
                isError: true,
                content: [{
                  type: "text" as const,
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
// Define the run_command tool handler separately so we can access it
const runCommandHandler = async ({ command }: { command: string }) => {
  // Initialize plugins if not already done
  if (!registry || !commandGuard) {
    let cfg = loadConfig();
    if (!cfg) {
      return {
        isError: true,
        content: [{
          type: "text" as const,
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
          type: "text" as const,
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
          type: "text" as const,
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
          type: "text" as const,
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
          type: "text" as const,
          text: `SSH execution error: ${error.message}`
        }
      ],
      annotations: {
        durationMs: Date.now() - start
      }
    };
  }
};

// Function to get the command schema with dynamic description
function getRunCommandSchema() {
  return {
    command: z.string().min(1, "command is required").describe(buildRunCommandDescription())
  };
}

/** Tool: run_command – execute a *single* shell command on the remote host */
server.tool(
  "run_command",
  getRunCommandSchema(),
  runCommandHandler
);

/** Tool: get_local_mode – returns the current local mode status from the config */
server.tool(
  "get_local_mode",
  {},
  async () => {
    try {
      const cfg = loadConfig();
      if (!cfg) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: "No SSH configuration found. Please run 'vssh --setup' first."
          }]
        };
      }
      
      return {
        content: [{
          type: "text" as const,
          text: `Local mode is currently ${cfg.localMode ? 'enabled' : 'disabled'}`
        }]
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{
          type: "text" as const,
          text: `Error reading configuration: ${error.message}`
        }]
      };
    }
  }
);

/** Tool: set_local_mode – sets the local mode in the config and saves it */
server.tool(
  "set_local_mode",
  {
    enabled: z.boolean().describe("Whether to enable or disable local mode")
  },
  async ({ enabled }) => {
    try {
      const cfg = loadConfig();
      if (!cfg) {
        return {
          isError: true,
          content: [{
            type: "text" as const,
            text: "No SSH configuration found. Please run 'vssh --setup' first."
          }]
        };
      }
      
      // Update the config
      cfg.localMode = enabled;
      
      // Save the updated config to disk
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
      
      return {
        content: [{
          type: "text" as const,
          text: `Local mode has been ${enabled ? 'enabled' : 'disabled'} successfully`
        }]
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{
          type: "text" as const,
          text: `Error updating configuration: ${error.message}`
        }]
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
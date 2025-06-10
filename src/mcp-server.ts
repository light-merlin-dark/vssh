#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { SSHService } from "./services/ssh";
import { CommandGuard } from "./services/command-guard";
import { loadConfig, setupInteractiveConfig } from "./config";

// 1. Boot the CLI in "server mode"
const server = new McpServer({
  name: "vssh",
  version: "1.2.0",
  description:
    "AI-friendly SSH proxy with safety guard (MCP tool)"
});

// 2. === TOOLS ================================================================
/** Tool: run_command – execute a *single* shell command on the remote host */
server.tool(
  "run_command",
  {
    /** Full shell command *exactly* as it would be typed in a terminal */
    command: z.string().min(1, "command is required")
  },
  async ({ command }) => {
    // Guard rails
    const guard = CommandGuard.checkCommand(command);
    
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
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error("MCP Server error:", error);
  process.exit(1);
});
#!/usr/bin/env node
import { spawn } from 'child_process';
import * as readline from 'readline';

/**
 * Utility to call MCP server methods programmatically
 * This is useful for testing and scripting MCP interactions
 */

interface MCPRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPClient {
  private process: any;
  private rl: readline.Interface | null = null;
  private responseHandlers: Map<number | string, (response: MCPResponse) => void> = new Map();
  private nextId = 1;

  constructor(private command: string, private args: string[] = []) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process = spawn(this.command, this.args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.rl = readline.createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      });

      this.rl.on('line', (line) => {
        try {
          const response = JSON.parse(line) as MCPResponse;
          const handler = this.responseHandlers.get(response.id);
          if (handler) {
            handler(response);
            this.responseHandlers.delete(response.id);
          }
        } catch (error) {
          console.error('Failed to parse MCP response:', line);
        }
      });

      this.process.on('error', reject);
      this.process.on('exit', (code: number) => {
        if (code !== 0) {
          reject(new Error(`MCP server exited with code ${code}`));
        }
      });

      // Give the process a moment to start
      setTimeout(resolve, 100);
    });
  }

  async call(method: string, params: any = {}): Promise<any> {
    const id = this.nextId++;
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.responseHandlers.set(id, (response) => {
        if (response.error) {
          reject(new Error(`MCP Error: ${response.error.message}`));
        } else {
          resolve(response.result);
        }
      });

      this.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  async close(): Promise<void> {
    if (this.rl) {
      this.rl.close();
    }
    if (this.process) {
      this.process.kill();
    }
  }
}

// Convenience function for one-off calls
export async function callMCP(
  serverPath: string, 
  method: string, 
  params: any = {},
  serverArgs: string[] = []
): Promise<any> {
  const client = new MCPClient(serverPath, serverArgs);
  try {
    await client.connect();
    
    // Initialize if not already initialized
    if (method !== 'initialize') {
      await client.call('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'vssh-call-mcp',
          version: '1.0.0'
        }
      });
    }
    
    const result = await client.call(method, params);
    return result;
  } finally {
    await client.close();
  }
}

// CLI interface when run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: call-mcp <server-path> <method> [params-json]');
    console.error('Example: call-mcp ./dist/src/mcp-server.js tools/list');
    console.error('Example: call-mcp ./dist/src/mcp-server.js tools/call \'{"name":"run_command","arguments":{"command":"ls"}}\'');
    process.exit(1);
  }
  
  const [serverPath, method, paramsJson] = args;
  const params = paramsJson ? JSON.parse(paramsJson) : {};
  
  callMCP(serverPath, method, params)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
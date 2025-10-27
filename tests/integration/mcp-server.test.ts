import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as path from 'path';
import { MCPClient } from '../../src/utils/call-mcp';

describe('MCP Server Integration', () => {
  let client: MCPClient;
  const mcpServerPath = path.join(__dirname, '../../dist/src/mcp-server.js');

  beforeAll(async () => {
    client = new MCPClient('node', [mcpServerPath]);
    await client.connect();
    
    // Initialize the server
    await client.call('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'vssh-test',
        version: '1.0.0'
      }
    });
  });

  afterAll(async () => {
    await client.close();
  });

  it('should list available tools', async () => {
    const result = await client.call('tools/list');
    
    expect(result).toHaveProperty('tools');
    expect(Array.isArray(result.tools)).toBe(true);
    
    // Check for core tools
    const toolNames = result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('run_command');
    expect(toolNames).toContain('get_local_mode');
    expect(toolNames).toContain('set_local_mode');
    
    // Check for plugin tools
    expect(toolNames).toContain('list_docker_containers');
    expect(toolNames).toContain('show_docker_logs');
  });

  it('should get local mode status', async () => {
    const result = await client.call('tools/call', {
      name: 'get_local_mode',
      arguments: {}
    });
    
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('text');
    expect(result.content[0].text).toMatch(/Local mode is currently (enabled|disabled)/);
  });

  it('should block dangerous commands', async () => {
    const result = await client.call('tools/call', {
      name: 'run_command',
      arguments: {
        command: 'rm -rf /'
      }
    });
    
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('text');
    expect(result.content[0].text).toContain('Command blocked');
  });

  it('should execute safe commands', async () => {
    const result = await client.call('tools/call', {
      name: 'run_command',
      arguments: {
        command: 'echo "Hello from vssh MCP"'
      }
    });
    
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('text');
    
    // The result should contain the echo output
    const output = result.content[0].text;
    expect(output).toContain('Hello from vssh MCP');
  });
});
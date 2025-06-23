# vssh Utilities

## call-mcp

A utility for programmatically interacting with MCP (Model Context Protocol) servers. This tool is useful for developers who want to test MCP servers, script MCP interactions, or integrate MCP functionality into their applications.

### Usage

#### As a CLI Tool

```bash
# List available tools
npm run call-mcp dist/src/mcp-server.js tools/list

# Call a specific tool
npm run call-mcp dist/src/mcp-server.js tools/call '{"name":"run_command","arguments":{"command":"ls -la"}}'

# Check local mode status
npm run call-mcp dist/src/mcp-server.js tools/call '{"name":"get_local_mode","arguments":{}}'
```

#### As a Library

```typescript
import { callMCP, MCPClient } from './utils/call-mcp';

// One-off call
const result = await callMCP(
  './dist/src/mcp-server.js',
  'tools/list'
);

// Persistent connection for multiple calls
const client = new MCPClient('node', ['./dist/src/mcp-server.js']);
await client.connect();

await client.call('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: {
    name: 'my-app',
    version: '1.0.0'
  }
});

const tools = await client.call('tools/list');
console.log('Available tools:', tools);

await client.close();
```

### Benefits

- **No echo commands**: Interact with MCP servers without shell echo commands
- **Type-safe**: Written in TypeScript with proper types
- **Reusable**: Can be used as both a CLI tool and a library
- **Testing**: Perfect for integration tests and MCP server validation
- **Scripting**: Automate MCP interactions in build scripts or CI/CD

### Example: Testing MCP Server

```typescript
// Test that dangerous commands are blocked
const result = await callMCP(
  './dist/src/mcp-server.js',
  'tools/call',
  {
    name: 'run_command',
    arguments: { command: 'rm -rf /' }
  }
);

console.assert(result.content[0].text.includes('Command blocked'));
```
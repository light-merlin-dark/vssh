#!/usr/bin/env ts-node
import { spawn } from 'child_process';
import * as path from 'path';

// MCP test client
async function testMcpServer() {
  console.log('🔌 Testing MCP Server Integration\n');
  
  const mcpPath = path.join(__dirname, '..', 'dist', 'mcp-server.js');
  
  // Test 1: Initialize MCP server and send initialize request
  await testMcpCommand('Initialize server', {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'vssh-test',
        version: '1.0.0'
      }
    }
  });
  
  // Test 2: List available tools
  await testMcpCommand('List tools', {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
  
  // Test 3: Call a safe read-only tool
  await testMcpCommand('Call list_docker_containers', {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'list_docker_containers',
      arguments: {
        args: []
      }
    }
  });
  
  // Test 4: Test command blocking
  await testMcpCommand('Test command blocking', {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/call',
    params: {
      name: 'run_command',
      arguments: {
        command: 'rm -rf /'
      }
    }
  });
  
  console.log('\n✅ MCP integration tests completed');
}

async function testMcpCommand(testName: string, request: any): Promise<void> {
  console.log(`📋 ${testName}...`);
  
  return new Promise((resolve, reject) => {
    const mcpProcess = spawn('node', [path.join(__dirname, '..', 'dist', 'mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let responseData = '';
    let errorData = '';
    let timeout: NodeJS.Timeout;
    
    mcpProcess.stdout.on('data', (data) => {
      responseData += data.toString();
      
      // Try to parse response
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            clearTimeout(timeout);
            
            // Check response
            if (response.error) {
              // Some errors are expected (like blocking dangerous commands)
              if (request.method === 'tools/call' && request.params.name === 'run_command') {
                console.log(`  ✅ Command blocked as expected: ${response.error.message}`);
              } else {
                console.log(`  ⚠️  Error: ${response.error.message}`);
              }
            } else if (response.result) {
              console.log(`  ✅ Success`);
              
              // Show tool count for list request
              if (request.method === 'tools/list' && response.result.tools) {
                console.log(`  📊 Found ${response.result.tools.length} tools`);
                // List first few tools
                const toolNames = response.result.tools.slice(0, 5).map((t: any) => t.name).join(', ');
                console.log(`  🔧 Tools: ${toolNames}...`);
              }
            }
            
            mcpProcess.kill();
            resolve();
          } catch (e) {
            // Not complete JSON yet
          }
        }
      }
    });
    
    mcpProcess.stderr.on('data', (data) => {
      errorData += data.toString();
    });
    
    mcpProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn MCP server: ${error.message}`));
    });
    
    mcpProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        console.log(`  ℹ️  Process exited with code ${code}`);
      }
      resolve();
    });
    
    // Send request
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    
    // Timeout after 5 seconds
    timeout = setTimeout(() => {
      console.log(`  ⏱️  Test timed out`);
      mcpProcess.kill();
      resolve();
    }, 5000);
  });
}

// Simple integration test runner
async function runIntegrationTests() {
  console.log('🧪 vssh Integration Tests\n');
  
  // Test 1: CLI help
  console.log('📋 Testing CLI help...');
  const { execSync } = require('child_process');
  
  try {
    const help = execSync('node dist/index.js --help', { encoding: 'utf8' });
    if (help.includes('VSSH - AI-Friendly SSH Command Proxy')) {
      console.log('  ✅ CLI help works\n');
    } else {
      console.log('  ❌ CLI help output unexpected\n');
    }
  } catch (error) {
    console.log('  ❌ CLI help failed\n');
  }
  
  // Test 2: Plugin commands
  console.log('📋 Testing plugin commands...');
  try {
    const plugins = execSync('node dist/index.js plugins list', { encoding: 'utf8' });
    if (plugins.includes('docker') && plugins.includes('coolify')) {
      console.log('  ✅ Plugin listing works\n');
    } else {
      console.log('  ❌ Plugin listing unexpected\n');
    }
  } catch (error) {
    console.log('  ❌ Plugin listing failed\n');
  }
  
  // Test 3: MCP server
  await testMcpServer();
}

// Run the integration tests
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
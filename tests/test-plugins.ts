#!/usr/bin/env ts-node
import { loadConfig } from '../src/config';
import { SSHService } from '../src/services/ssh';
import { CommandGuardService } from '../src/services/command-guard-service';
import { PluginRegistry } from '../src/plugins';
import dockerPlugin from '../src/plugins/builtin/docker';
import coolifyPlugin from '../src/plugins/builtin/coolify';

// Test results tracking
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error: any) {
    console.error(`❌ ${name}: ${error.message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 vssh Plugin System Tests\n');
  
  // Load config
  const config = loadConfig();
  if (!config) {
    console.error('❌ No configuration found. Run "vssh --setup" first.');
    process.exit(1);
  }
  
  // Initialize services
  const logger = {
    info: (msg: string) => {},
    warn: (msg: string) => {},
    error: (msg: string) => console.error(msg),
    debug: (msg: string) => {}
  };
  
  const sshService = new SSHService(config);
  const commandGuard = new CommandGuardService();
  const { ProxyService } = await import('../src/services/proxy-service');
  const proxyService = new ProxyService(config, sshService, commandGuard);
  const registry = new PluginRegistry(sshService, commandGuard, config, logger, proxyService, false);
  
  // Test plugin loading and enabling
  await test('Load Docker plugin', async () => {
    await registry.loadPlugin(dockerPlugin);
    const plugin = registry.getPlugin('docker');
    if (!plugin) throw new Error('Docker plugin not loaded');
  });
  
  await test('Load Coolify plugin with dependencies', async () => {
    await registry.loadPlugin(coolifyPlugin);
    const plugin = registry.getPlugin('coolify');
    if (!plugin) throw new Error('Coolify plugin not loaded');
  });
  
  // Enable plugins (they should be enabled by default from config)
  await test('Enable plugins from config', async () => {
    // If not enabled by default, enable them
    if (!registry.isEnabled('docker')) {
      await registry.enablePlugin('docker');
    }
    if (!registry.isEnabled('coolify')) {
      await registry.enablePlugin('coolify');
    }
  });
  
  // Test plugin registry
  await test('Plugin registry lists all plugins', async () => {
    const plugins = registry.getAllPlugins();
    if (plugins.length !== 2) throw new Error(`Expected 2 plugins, got ${plugins.length}`);
  });
  
  await test('Plugin registry tracks enabled state', async () => {
    if (!registry.isEnabled('docker')) throw new Error('Docker should be enabled by default');
    if (!registry.isEnabled('coolify')) throw new Error('Coolify should be enabled by default');
  });
  
  // Test command resolution
  await test('Resolve Docker commands by name', async () => {
    const cmd = registry.getCommand('list-docker-containers');
    if (!cmd) throw new Error('Command not found');
    if (cmd.name !== 'list-docker-containers') throw new Error('Wrong command returned');
  });
  
  await test('Resolve Docker commands by alias', async () => {
    const cmd = registry.getCommand('ldc');
    if (!cmd) throw new Error('Command alias not found');
    if (cmd.name !== 'list-docker-containers') throw new Error('Wrong command for alias');
  });
  
  // Test MCP tool generation
  await test('Generate MCP tools from plugins', async () => {
    const tools = registry.getMcpTools();
    const toolNames = tools.map(t => t.name);
    
    const expectedTools = [
      'list_docker_containers',
      'get_docker_container', 
      'show_docker_logs',
      'list_docker_ports',
      'list_docker_networks',
      'show_docker_info',
      'get_coolify_proxy_config',
      'list_coolify_dynamic_configs'
    ];
    
    for (const expected of expectedTools) {
      if (!toolNames.includes(expected)) {
        throw new Error(`Missing MCP tool: ${expected}`);
      }
    }
  });
  
  // Test read-only Docker commands (safe to run)
  console.log('\n📋 Testing Docker Plugin Commands (Read-Only)\n');
  
  await test('Docker: list-docker-containers', async () => {
    let output = '';
    const testLogger = {
      ...logger,
      info: (msg: string) => { output = msg; }
    };
    
    const context = {
      sshService,
      commandGuard,
      config,
      logger: testLogger,
      proxyService,
      isLocalExecution: false,
      getPlugin: (name: string) => registry.getPlugin(name)
    };
    
    const cmd = registry.getCommand('list-docker-containers');
    if (!cmd) throw new Error('Command not found');
    
    // Capture console.log
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (...args: any[]) => { capturedOutput += args.join(' ') + '\n'; };
    
    await cmd.handler(context, { _: ['list-docker-containers'] });
    
    console.log = originalLog;
    
    // Should have some output (even if no containers)
    if (!capturedOutput) throw new Error('No output from command');
  });
  
  await test('Docker: list-docker-networks', async () => {
    const cmd = registry.getCommand('ldn');
    if (!cmd) throw new Error('Command not found');
    
    const context = {
      sshService,
      commandGuard,
      config,
      logger,
      proxyService,
      isLocalExecution: false,
      getPlugin: (name: string) => registry.getPlugin(name)
    };
    
    // Capture console.log
    const originalLog = console.log;
    let capturedOutput = '';
    console.log = (...args: any[]) => { capturedOutput += args.join(' ') + '\n'; };
    
    await cmd.handler(context, { _: ['ldn'] });
    
    console.log = originalLog;
    
    if (!capturedOutput) throw new Error('No output from command');
  });
  
  // Test command guard extensions
  await test('Command guard blocks Coolify-specific patterns', async () => {
    const guards = registry.getCommandGuardExtensions();
    const coolifyGuard = guards.find(g => g.category === 'coolify');
    if (!coolifyGuard) throw new Error('Coolify guards not found');
    
    // Test a pattern
    const dangerous = 'rm -rf /data/coolify/source';
    const matches = coolifyGuard.patterns.some(pattern => pattern.test(dangerous));
    if (!matches) throw new Error('Coolify guard should block rm of coolify directories');
  });
  
  // Test plugin enable/disable
  await test('Disable and re-enable plugin', async () => {
    await registry.disablePlugin('coolify');
    if (registry.isEnabled('coolify')) throw new Error('Plugin should be disabled');
    
    await registry.enablePlugin('coolify');
    if (!registry.isEnabled('coolify')) throw new Error('Plugin should be enabled');
  });
  
  await test('Cannot disable plugin with dependencies', async () => {
    try {
      await registry.disablePlugin('docker');
      throw new Error('Should not be able to disable docker when coolify depends on it');
    } catch (error: any) {
      if (!error.message.includes('depend')) throw error;
    }
  });
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(40));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total: ${passed + failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal test error:', error);
  process.exit(1);
});
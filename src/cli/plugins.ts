import { PluginRegistry } from '../plugins';

export async function handlePluginsCommand(
  registry: PluginRegistry,
  args: string[]
): Promise<void> {
  const subcommand = args[0];
  
  switch (subcommand) {
    case 'list':
    case 'ls':
      await listPlugins(registry);
      break;
      
    case 'enable':
      if (!args[1]) {
        console.error('Error: Plugin name required');
        console.error('Usage: vssh plugins enable <plugin-name>');
        process.exit(1);
      }
      await enablePlugin(registry, args[1]);
      break;
      
    case 'disable':
      if (!args[1]) {
        console.error('Error: Plugin name required');
        console.error('Usage: vssh plugins disable <plugin-name>');
        process.exit(1);
      }
      await disablePlugin(registry, args[1]);
      break;
      
    case 'info':
      if (!args[1]) {
        console.error('Error: Plugin name required');
        console.error('Usage: vssh plugins info <plugin-name>');
        process.exit(1);
      }
      await showPluginInfo(registry, args[1]);
      break;
      
    default:
      console.error(`Unknown plugins subcommand: ${subcommand}`);
      console.error('Available subcommands: list, enable, disable, info');
      process.exit(1);
  }
}

async function listPlugins(registry: PluginRegistry): Promise<void> {
  const allPlugins = registry.getAllPlugins();
  
  if (allPlugins.length === 0) {
    console.log('No plugins installed');
    return;
  }
  
  console.log('Installed plugins:');
  console.log('');
  
  const maxNameLength = Math.max(...allPlugins.map(p => p.name.length));
  const maxVersionLength = Math.max(...allPlugins.map(p => p.version.length));
  
  for (const plugin of allPlugins) {
    const status = registry.isEnabled(plugin.name) ? '✓ enabled' : '✗ disabled';
    const statusColor = registry.isEnabled(plugin.name) ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';
    
    console.log(
      `  ${plugin.name.padEnd(maxNameLength)} ` +
      `v${plugin.version.padEnd(maxVersionLength)} ` +
      `${statusColor}${status}${resetColor} ` +
      `- ${plugin.description}`
    );
  }
}

async function enablePlugin(registry: PluginRegistry, name: string): Promise<void> {
  try {
    await registry.enablePlugin(name);
    console.log(`✓ Plugin '${name}' enabled successfully`);
    
    // Show any dependencies that were also enabled
    const plugin = registry.getPlugin(name);
    if (plugin?.dependencies && plugin.dependencies.length > 0) {
      console.log(`  Dependencies enabled: ${plugin.dependencies.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`✗ Failed to enable plugin '${name}': ${error.message}`);
    process.exit(1);
  }
}

async function disablePlugin(registry: PluginRegistry, name: string): Promise<void> {
  try {
    await registry.disablePlugin(name);
    console.log(`✓ Plugin '${name}' disabled successfully`);
  } catch (error: any) {
    console.error(`✗ Failed to disable plugin '${name}': ${error.message}`);
    process.exit(1);
  }
}

async function showPluginInfo(registry: PluginRegistry, name: string): Promise<void> {
  const plugin = registry.getPlugin(name);
  
  if (!plugin) {
    console.error(`Plugin '${name}' not found`);
    process.exit(1);
  }
  
  console.log(`Plugin: ${plugin.name}`);
  console.log(`Version: ${plugin.version}`);
  console.log(`Description: ${plugin.description}`);
  if (plugin.author) {
    console.log(`Author: ${plugin.author}`);
  }
  console.log(`Status: ${registry.isEnabled(name) ? 'enabled' : 'disabled'}`);
  
  if (plugin.dependencies && plugin.dependencies.length > 0) {
    console.log(`Dependencies: ${plugin.dependencies.join(', ')}`);
  }
  
  console.log('');
  console.log('Commands:');
  
  for (const command of plugin.commands) {
    const aliases = command.aliases ? ` (${command.aliases.join(', ')})` : '';
    console.log(`  ${command.name}${aliases}`);
    console.log(`    ${command.description}`);
    if (command.usage) {
      console.log(`    Usage: ${command.usage}`);
    }
  }
  
  if (plugin.mcpTools && plugin.mcpTools.length > 0) {
    console.log('');
    console.log('MCP Tools:');
    for (const tool of plugin.mcpTools) {
      console.log(`  ${tool.name} - ${tool.description}`);
    }
  }
}
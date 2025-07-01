#!/usr/bin/env node
import { executeProxy } from './proxy';
import { loadConfig, setupInteractiveConfig, Config } from './config';
import { PluginRegistry, PluginLoader } from './plugins';
import { SSHService } from './services/ssh';
import { CommandGuardService } from './services/command-guard-service';
import { ProxyService } from './services/proxy-service';
import { handlePluginsCommand } from './cli/plugins';
import { handleInstallCommand } from './cli/install';
import * as fs from 'fs/promises';
import * as path from 'path';

function showHelp(registry?: PluginRegistry) {
  console.log(`
VSSH - AI-Friendly SSH Command Proxy with Safety Guards

DESCRIPTION:
  vssh helps AI assistants safely execute commands on remote servers.
  It provides automatic safety checks and clear command syntax.

SYNTAX:
  vssh <command> [arguments...]
  vssh "full command string"  # AI-friendly: entire command in quotes
  vssh --setup                # Interactive setup wizard
  vssh install                # Install vssh as MCP server in Claude Code
  vssh --help                 # Show this help message
  vssh --local <command>      # Execute command locally instead of on remote server

BASIC USAGE:
  vssh ls                     # Simple command
  vssh ls -la /var/log        # Command with arguments  
  vssh "docker ps -a"         # Full command in quotes (AI-friendly)
  vssh echo "hello world"     # Double quotes OK for arguments

PLUGIN MANAGEMENT:
  vssh plugins list           # List available plugins
  vssh plugins enable <name>  # Enable a plugin
  vssh plugins disable <name> # Disable a plugin
  vssh plugins info <name>    # Show plugin details`);

  // Dynamic plugin help section
  if (registry) {
    const enabledPlugins = registry.getEnabledPlugins();
    const categorizedPlugins = new Map<string, typeof enabledPlugins>();
    
    // Group plugins by category
    enabledPlugins.forEach(plugin => {
      const category = plugin.helpSummary?.category || 'Other';
      if (!categorizedPlugins.has(category)) {
        categorizedPlugins.set(category, []);
      }
      categorizedPlugins.get(category)!.push(plugin);
    });

    // Sort categories for consistent display
    const sortedCategories = Array.from(categorizedPlugins.keys()).sort();
    
    if (sortedCategories.length > 0) {
      console.log(`

AVAILABLE COMMANDS BY CATEGORY:`);
      
      sortedCategories.forEach(category => {
        console.log(`\n  ${category}:`);
        const plugins = categorizedPlugins.get(category)!;
        
        plugins.forEach(plugin => {
          if (plugin.helpSummary) {
            console.log(`    ${plugin.helpSummary.shortSummary}`);
            if (plugin.helpSummary.examples && plugin.helpSummary.examples.length > 0) {
              plugin.helpSummary.examples.slice(0, 2).forEach(example => {
                console.log(`      ${example}`);
              });
            }
          }
        });
      });
    }
  }

  console.log(`

SYSTEM COMMANDS:
  vssh df -h                  # Disk usage
  vssh free -m                # Memory usage
  vssh ps aux                 # Process list
  vssh systemctl status nginx # Service status

COMPLEX COMMANDS:
  vssh 'ps aux | grep node'   # Use single quotes for pipes
  vssh 'cat log | grep error' # Shell features need single quotes

CONFIGURATION:
  First run: vssh --setup
  Config saved to: ~/.vssh/config.json
  
  Environment variables (optional):
    VSSH_HOST      Target SSH host
    VSSH_USER      SSH user (default: root)
    VSSH_KEY_PATH  SSH private key path

IMPORTANT FOR AI TOOLS:
  • For best AI compatibility, wrap entire commands in quotes: ✅ vssh "docker ps -a"
  • Simple commands work without quotes too: ✅ vssh docker ps
  • Use single quotes for shell features: ✅ vssh 'ps | grep app'
`);
}

/**
 * Detects if the CLI is being called by Claude (AI assistant)
 */
function isCalledByClaude(): boolean {
  // Check for CLAUDECODE environment variable
  if (process.env.CLAUDECODE === '1') {
    return true;
  }
  
  // Check for lack of TTY (Claude runs commands without TTY)
  if (!process.stdin.isTTY && !process.stdout.isTTY && !process.stderr.isTTY) {
    // Additional check for Claude-specific patterns
    if (process.env.CLAUDE_CODE_ENTRYPOINT === 'cli') {
      return true;
    }
  }
  
  return false;
}

async function main() {
  const args = process.argv.slice(2);

  // Skip Claude detection message for certain commands
  const skipClaudeMessage = args.length === 0 || 
    args[0] === '--help' || 
    args[0] === '-h' || 
    args[0] === '--setup' || 
    args[0] === 'install' ||
    args[0] === 'plugins';

  // Claude detection message removed - direct CLI usage is preferred

  // Check for --local flag
  const localIndex = args.findIndex(arg => arg === '--local' || arg === '-l');
  const hasLocalFlag = localIndex !== -1;
  if (hasLocalFlag) {
    // Remove the flag from args
    args.splice(localIndex, 1);
  }

  const isHelpCommand = args.length === 0 || args[0] === '--help' || args[0] === '-h' || args[0] === 'help';

  // Handle setup
  if (args[0] === '--setup') {
    await setupInteractiveConfig();
    process.exit(0);
  }

  // Handle install
  if (args[0] === 'install') {
    await handleInstallCommand();
    process.exit(0);
  }

  // Load config - run setup if not found
  const config = loadConfig();
  if (!config) {
    if (isHelpCommand) {
      // Show basic help if no config available
      showHelp();
      process.exit(0);
    }
    console.log('No SSH configuration found.');
    console.log('\nPlease run: vssh --setup\n');
    process.exit(1);
  }

  // Validate config has proper values
  if (config.host === 'test' || config.keyPath === '/test' || !config.host || !config.keyPath) {
    console.error('❌ Invalid SSH configuration detected.');
    console.error('\nYour configuration appears to have placeholder values:');
    console.error(`  Host: ${config.host}`);
    console.error(`  User: ${config.user}`);
    console.error(`  Key Path: ${config.keyPath}`);
    console.error('\nPlease run: vssh --setup');
    console.error('to configure your SSH connection properly.\n');
    process.exit(1);
  }

  // Check if SSH key file exists
  try {
    await fs.access(config.keyPath, fs.constants.R_OK);
  } catch (error) {
    console.error(`❌ SSH key file not found or not readable: ${config.keyPath}`);
    console.error('\nPlease run: vssh --setup');
    console.error('to select a valid SSH key.\n');
    process.exit(1);
  }

  // Determine local execution mode
  const isLocalExecution = hasLocalFlag || config.localMode === true;
  
  // Initialize plugin system
  const logger = {
    info: (msg: string) => console.log(`ℹ️  ${msg}`),
    warn: (msg: string) => console.warn(`⚠️  ${msg}`),
    error: (msg: string) => console.error(`❌ ${msg}`),
    debug: (msg: string) => console.debug(`🔍 ${msg}`)
  };
  
  const sshService = new SSHService(config);
  const commandGuard = new CommandGuardService();
  const proxyService = new ProxyService(config, sshService, commandGuard);
  proxyService.setLocalMode(isLocalExecution);
  const registry = new PluginRegistry(sshService, commandGuard, config, logger, proxyService, isLocalExecution);
  
  // Apply plugin command guard extensions
  commandGuard.addExtensions(registry.getCommandGuardExtensions());
  
  // Load built-in plugins
  const loader = new PluginLoader();
  const builtinPlugins = await loader.loadBuiltinPlugins();
  
  for (const plugin of builtinPlugins) {
    try {
      await registry.loadPlugin(plugin);
    } catch (error: any) {
      logger.error(`Failed to load plugin ${plugin.name}: ${error.message}`);
    }
  }
  
  // Handle help with loaded plugins
  if (isHelpCommand) {
    showHelp(registry);
    process.exit(0);
  }
  
  // Handle plugin management commands
  if (args[0] === 'plugins' || args[0] === 'plugin') {
    await handlePluginsCommand(registry, args.slice(1));
    process.exit(0);
  }

  // Check if this is a plugin command
  const commandName = args[0];
  const command = registry.getCommand(commandName);
  
  if (command) {
    try {
      // Parse arguments for plugin command
      const parsedArgs = {
        _: args,
        ...parseFlags(args.slice(1))
      };
      
      // Use the registry's executeCommand method which handles dependency checking
      await registry.executeCommand(commandName, parsedArgs);
    } catch (error: any) {
      console.error(`❌ ${error.message}`);
      process.exit(1);
    }
  } else {
    // Not a plugin command, use original proxy behavior
    let commandArgs: string[];
    
    // Handle -c or --command flag
    if (args[0] === '-c' || args[0] === '--command') {
      if (args.length < 2) {
        console.error('❌ Error: -c/--command requires a command string');
        process.exit(1);
      }
      // Take the next argument as the complete command
      commandArgs = [args[1]];
    } else {
      // Original behavior: treat all args as the command
      commandArgs = args;
    }

    // Execute command via SSH proxy
    await executeProxy(commandArgs, config, commandGuard);
  }
}

// Simple flag parser for plugin commands
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
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
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

main().catch((error: any) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
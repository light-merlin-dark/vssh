#!/usr/bin/env node
import { executeProxy } from './proxy';
import { loadConfig, setupInteractiveConfig } from './config';

function showHelp() {
  console.log(`
VSSH - AI-Friendly SSH Command Proxy with Safety Guards

DESCRIPTION:
  vssh helps AI assistants safely execute commands on remote servers.
  It provides automatic safety checks and clear command syntax.

SYNTAX:
  vssh <command> [arguments...]
  vssh --setup                # Interactive setup wizard
  vssh --help                 # Show this help message

FEATURES FOR AI ASSISTANTS:
  • Clear command syntax that works with AI tool permissions
  • Automatic blocking of dangerous commands (rm -rf /, dd to disk, etc.)
  • All commands logged for audit trail
  • Simple setup with saved configuration

BASIC USAGE:
  vssh ls                     # Simple command
  vssh ls -la /var/log        # Command with arguments
  vssh echo "hello world"     # Double quotes OK for arguments

DOCKER COMMANDS:
  vssh docker ps              # List containers
  vssh docker ps -a           # List all containers
  vssh docker logs app        # View container logs
  vssh docker exec app ls     # Execute command in container

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
  • NEVER wrap entire command in double quotes: ❌ vssh "docker ps"
  • Simple commands need no quotes: ✅ vssh docker ps
  • Use single quotes for shell features: ✅ vssh 'ps | grep app'
`);
}

async function main() {
  const args = process.argv.slice(2);

  // Handle help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    process.exit(0);
  }

  // Handle setup
  if (args[0] === '--setup') {
    await setupInteractiveConfig();
    process.exit(0);
  }

  // Load config - run setup if not found
  const config = loadConfig();
  if (!config) {
    console.log('No SSH configuration found.');
    console.log('\nPlease run: vssh --setup\n');
    process.exit(1);
  }

  // Execute command
  await executeProxy(args);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
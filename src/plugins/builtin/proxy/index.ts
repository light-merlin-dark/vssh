import { VsshPlugin, PluginContext, ParsedArgs } from '../../types';
import * as fs from 'fs';
import { CONFIG_PATH } from '../../../config';

function saveConfig(config: any): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

const proxyPlugin: VsshPlugin = {
  name: 'proxy',
  version: '1.0.0',
  description: 'Core proxy functionality for remote command execution',
  author: 'VSSH Core',

  helpSummary: {
    shortSummary: 'Core proxy commands - proxy/run/exec (execute commands), lm (local mode toggle)',
    longSummary: 'Essential remote command execution functionality. Execute commands on remote server (proxy/run/exec) and manage local/remote execution mode (lm). Core functionality for all vssh operations.',
    category: 'Core',
    keyCommands: ['proxy', 'run', 'exec', 'lm'],
    examples: [
      'vssh proxy "ls -la"  # Execute command remotely',
      'vssh run "docker ps"  # Same as proxy',
      'vssh lm on  # Enable local mode'
    ]
  },

  commands: [
    {
      name: 'proxy',
      aliases: ['run', 'exec'],
      description: 'Execute a command on the remote server',
      usage: 'vssh proxy <command>',
      examples: [
        'vssh proxy ls -la',
        'vssh proxy "docker ps"',
        'vssh run "cd /app && npm test"'
      ],
      handler: async (context: PluginContext, args: ParsedArgs) => {
        if (args._.length === 0) {
          console.error('Error: No command provided');
          console.log('Usage: vssh proxy <command>');
          process.exit(1);
        }

        const command = args._.join(' ');
        
        try {
          const result = await context.proxyService.executeCommand(command);
          
          // Output result
          if (result.output.trim()) {
            console.log(result.output);
          }
        } catch (error: any) {
          console.error(`Error executing command: ${error.message}`);
          process.exit(1);
        }
      }
    },
    {
      name: 'local-mode',
      aliases: ['lm'],
      description: 'Manage local execution mode',
      usage: 'vssh local-mode [on|off|status]',
      examples: [
        'vssh local-mode on',
        'vssh local-mode off',
        'vssh local-mode status'
      ],
      handler: async (context: PluginContext, args: ParsedArgs) => {
        const action = args._[1];
        
        if (!action || action === 'status') {
          // Show current status
          const currentMode = context.config.localMode || false;
          console.log(`Local mode is currently: ${currentMode ? 'ENABLED' : 'DISABLED'}`);
          if (currentMode) {
            console.log('Commands will execute locally by default.');
          } else {
            console.log('Commands will execute on remote server by default.');
          }
          return;
        }
        
        if (action === 'on' || action === 'enable') {
          // Enable local mode
          context.config.localMode = true;
          saveConfig(context.config);
          console.log('✅ Local mode ENABLED');
          console.log('Commands will now execute locally by default.');
        } else if (action === 'off' || action === 'disable') {
          // Disable local mode
          context.config.localMode = false;
          saveConfig(context.config);
          console.log('✅ Local mode DISABLED');
          console.log('Commands will now execute on remote server by default.');
        } else {
          console.error('Error: Invalid action. Use "on", "off", or "status"');
          process.exit(1);
        }
      }
    }
  ],

  mcpTools: [
    {
      name: 'run_command',
      description: 'Execute a command on the remote SSH server',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The command to execute on the remote server'
          }
        },
        required: ['command']
      }
    },
    {
      name: 'get_local_mode',
      description: 'Get the current local execution mode status',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'set_local_mode',
      description: 'Set the local execution mode (enable/disable local command execution)',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Whether to enable local execution mode'
          }
        },
        required: ['enabled']
      }
    }
  ],

  onLoad: async (context: PluginContext) => {
    // Proxy plugin loaded
  }
};

export default proxyPlugin;
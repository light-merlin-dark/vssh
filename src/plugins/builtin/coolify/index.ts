import { VsshPlugin } from '../../types';
import { getProxyConfigCommand } from './commands/get-proxy-config';
import { listDynamicConfigsCommand } from './commands/list-dynamic-configs';

const coolifyPlugin: VsshPlugin = {
  name: 'coolify',
  version: '1.0.0',
  description: 'Coolify-specific management commands',
  author: 'vssh',
  dependencies: ['docker'], // Requires docker plugin
  
  helpSummary: {
    shortSummary: 'Coolify proxy management - gcp (get proxy config), lcd (list dynamic configs)',
    longSummary: 'Specialized commands for Coolify self-hosting platform. Get Traefik proxy configuration (gcp) and list dynamic routing configurations (lcd). Requires docker plugin.',
    category: 'Infrastructure',
    keyCommands: ['gcp', 'lcd'],
    examples: [
      'vssh gcp  # Get proxy configuration',
      'vssh lcd  # List dynamic configs'
    ]
  },
  
  mcpContext: {
    section: 'COOLIFY COMMANDS',
    commands: [
      { command: 'vssh gcp', description: 'Get proxy configuration' },
      { command: 'vssh lcd', description: 'List dynamic configs' }
    ]
  },
  
  commands: [
    {
      name: 'get-coolify-proxy-config',
      aliases: ['gcp'],
      description: 'Get Coolify proxy configuration',
      usage: 'vssh get-coolify-proxy-config',
      examples: [
        'vssh get-coolify-proxy-config',
        'vssh gcp'
      ],
      handler: getProxyConfigCommand,
      mcpName: 'get_coolify_proxy_config'
    },
    {
      name: 'list-coolify-dynamic-configs',
      aliases: ['lcd'],
      description: 'List all Coolify dynamic configurations',
      usage: 'vssh list-coolify-dynamic-configs',
      examples: [
        'vssh list-coolify-dynamic-configs',
        'vssh lcd'
      ],
      handler: listDynamicConfigsCommand,
      mcpName: 'list_coolify_dynamic_configs'
    }
  ],
  
  mcpTools: [
    {
      name: 'get_coolify_proxy_config',
      description: 'Retrieve the main Coolify Traefik proxy configuration from docker-compose.yml',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'list_coolify_dynamic_configs',
      description: 'List and display all dynamic Traefik configurations from the Coolify proxy',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ],
  
  // Coolify-specific command guards
  commandGuards: [
    {
      category: 'coolify',
      patterns: [
        /rm\s+.*\/data\/coolify\/source/,
        /rm\s+.*\/data\/coolify\/proxy/,
      ],
      message: 'Deleting Coolify configuration directories is dangerous',
      suggestion: 'Use Coolify UI or API for configuration management'
    }
  ]
};

export default coolifyPlugin;
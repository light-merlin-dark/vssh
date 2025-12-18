import { VsshPlugin } from '../../types';
import { getProxyConfigCommand } from './commands/get-proxy-config';
import { listDynamicConfigsCommand } from './commands/list-dynamic-configs';
import { viewDynamicConfigCommand } from './commands/view-dynamic-config';
import { updateDynamicConfigCommand } from './commands/update-dynamic-config';
import { z } from 'zod';

const UpdateDynamicConfigSchema = z.object({
  localPath: z.string().describe('Local YAML file path to upload'),
  name: z.string().optional().describe('Optional config name (defaults to filename)')
});

const ViewDynamicConfigSchema = z.object({
  configName: z.string().describe('Name of the dynamic config to view')
});

const coolifyPlugin: VsshPlugin = {
  name: 'coolify',
  version: '1.0.0',
  description: 'Coolify-specific management commands',
  author: 'vssh',
  dependencies: ['docker'], // Requires docker plugin

  helpSummary: {
    shortSummary: 'Coolify proxy management - udc (update config), vdc (view config), lcd (list configs), gcp (get proxy config)',
    longSummary: 'Manage Coolify Traefik dynamic configurations. Update configs from local files (udc), view individual configs (vdc), list all configs (lcd), and get proxy configuration (gcp).',
    category: 'Infrastructure',
    keyCommands: ['udc', 'vdc', 'lcd', 'gcp'],
    examples: [
      'vssh udc ./my-service.yaml           # Update/create dynamic config',
      'vssh vdc my-service                  # View a specific config',
      'vssh lcd                             # List all dynamic configs',
      'vssh gcp                             # Get proxy configuration'
    ]
  },

  mcpContext: {
    section: 'COOLIFY COMMANDS',
    commands: [
      { command: 'vssh udc <file> [--name <n>]', description: 'Update/create dynamic config from local YAML' },
      { command: 'vssh vdc <name>', description: 'View a specific dynamic config' },
      { command: 'vssh ldc', description: 'List config filenames' },
      { command: 'vssh ldc <name>', description: 'View a specific config\'s contents' },
      { command: 'vssh gcp', description: 'Get proxy configuration' }
    ]
  },

  commands: [
    {
      name: 'update-dynamic-config',
      aliases: ['udc'],
      description: 'Update or create a Coolify dynamic config from a local YAML file',
      usage: 'vssh update-dynamic-config <local-yaml-file> [--name <config-name>]',
      examples: [
        'vssh udc ./my-service.yaml                    # Uses filename as config name',
        'vssh udc ./config.yaml --name my-service      # Custom config name',
        'vssh update-dynamic-config ./traefik.yaml     # Full command name'
      ],
      handler: updateDynamicConfigCommand,
      mcpName: 'update_dynamic_config',
      inputSchema: UpdateDynamicConfigSchema
    },
    {
      name: 'view-dynamic-config',
      aliases: ['vdc'],
      description: 'View a specific Coolify dynamic configuration',
      usage: 'vssh view-dynamic-config <config-name>',
      examples: [
        'vssh vdc my-service                  # View my-service.yaml',
        'vssh vdc analytics                   # View analytics.yaml',
        'vssh view-dynamic-config duplicatebot # Full command name'
      ],
      handler: viewDynamicConfigCommand,
      mcpName: 'view_dynamic_config',
      inputSchema: ViewDynamicConfigSchema
    },
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
      aliases: ['lcd', 'ldc'],
      description: 'List Coolify dynamic configurations, or view a specific config',
      usage: 'vssh list-coolify-dynamic-configs [config-name]',
      examples: [
        'vssh lcd                    # List all config filenames',
        'vssh lcd my-service         # View my-service.yaml contents',
        'vssh ldc analytics.yaml     # View specific config'
      ],
      handler: listDynamicConfigsCommand,
      mcpName: 'list_coolify_dynamic_configs'
    }
  ],

  mcpTools: [
    {
      name: 'update_dynamic_config',
      description: 'Update or create a Coolify Traefik dynamic configuration from a local YAML file. The config is uploaded to /data/coolify/proxy/dynamic/ and Traefik auto-reloads it.',
      inputSchema: {
        type: 'object',
        properties: {
          localPath: {
            type: 'string',
            description: 'Local path to the YAML config file'
          },
          name: {
            type: 'string',
            description: 'Optional config name. Defaults to the filename without extension.'
          }
        },
        required: ['localPath']
      }
    },
    {
      name: 'view_dynamic_config',
      description: 'View a specific Coolify Traefik dynamic configuration by name',
      inputSchema: {
        type: 'object',
        properties: {
          configName: {
            type: 'string',
            description: 'Name of the config to view (with or without .yaml extension)'
          }
        },
        required: ['configName']
      }
    },
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
      description: 'List dynamic Traefik config filenames from Coolify proxy. Pass configName to view a specific config\'s contents.',
      inputSchema: {
        type: 'object',
        properties: {
          configName: {
            type: 'string',
            description: 'Optional config name to view contents (e.g., "my-service" or "my-service.yaml")'
          }
        }
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

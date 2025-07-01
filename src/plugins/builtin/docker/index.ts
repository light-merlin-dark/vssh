import { VsshPlugin } from '../../types';
import { z } from 'zod';
import { listContainersCommand, listContainersMcpHandler } from './commands/list-containers';
import { getContainerCommand } from './commands/get-container';
import { showLogsCommand } from './commands/show-logs';
import { listPortsCommand } from './commands/list-ports';
import { listNetworksCommand } from './commands/list-networks';
import { showInfoCommand } from './commands/show-info';
import { ListContainersArgsSchema, GetContainerArgsSchema, ShowLogsArgsSchema } from './types';

// Plugin configuration schema
const DockerConfigSchema = z.object({
  defaultRegistry: z.string().optional(),
  cacheTimeout: z.number().default(10000),
  enableMetrics: z.boolean().default(false)
}).optional();

const dockerPlugin: VsshPlugin = {
  name: 'docker',
  version: '2.0.0',
  description: 'Docker container management commands with enhanced MCP support',
  author: 'vssh',
  configSchema: DockerConfigSchema,
  
  runtimeDependencies: [
    {
      command: 'docker',
      displayName: 'Docker',
      checkCommand: 'which docker',
      installHint: 'Please install Docker from https://docker.com'
    }
  ],
  
  helpSummary: {
    shortSummary: 'Docker container management - ldc (list), gdc (get), sdl (logs), ldp (ports), ldn (networks), sdi (info)',
    longSummary: 'Complete Docker container management suite with 6 core commands. List containers (ldc), find specific containers (gdc), show logs (sdl), view port mappings (ldp), list networks (ldn), and display system info (sdi). Supports both CLI and MCP integration.',
    category: 'Infrastructure',
    keyCommands: ['ldc', 'gdc', 'sdl', 'ldp', 'ldn', 'sdi'],
    examples: [
      'vssh ldc  # List all containers',
      'vssh gdc myapp  # Find container by name',
      'vssh sdl web --tail 50  # Show logs'
    ]
  },
  
  mcpContext: {
    section: 'DOCKER COMMANDS',
    commands: [
      { command: 'vssh ldc', description: 'List all containers' },
      { command: 'vssh gdc myapp', description: 'Find container by name' },
      { command: 'vssh sdl web --tail 50', description: 'Show container logs' },
      { command: 'vssh ldp', description: 'List port mappings' },
      { command: 'vssh ldn', description: 'List networks' },
      { command: 'vssh sdi', description: 'Show Docker system info' }
    ]
  },
  
  commands: [
    {
      name: 'list-docker-containers',
      aliases: ['ldc'],
      description: 'List all Docker containers',
      usage: 'vssh list-docker-containers [--all] [--limit <n>]',
      examples: [
        'vssh list-docker-containers',
        'vssh ldc',
        'vssh ldc --all',
        'vssh ldc --limit 10'
      ],
      handler: listContainersCommand,
      mcpName: 'list_docker_containers',
      inputSchema: ListContainersArgsSchema
    },
    {
      name: 'get-docker-container',
      aliases: ['gdc'],
      description: 'Find a single container by search pattern',
      usage: 'vssh get-docker-container <search-term> [--startsWith] [--endsWith] [--returnName]',
      examples: [
        'vssh get-docker-container myapp',
        'vssh gdc prod --startsWith',
        'vssh gdc --returnName web'
      ],
      handler: getContainerCommand,
      mcpName: 'get_docker_container',
      inputSchema: GetContainerArgsSchema
    },
    {
      name: 'show-docker-logs',
      aliases: ['sdl'],
      description: 'Show container logs',
      usage: 'vssh show-docker-logs <container> [container2...] [--tail n] [--verbose]',
      examples: [
        'vssh show-docker-logs myapp',
        'vssh sdl web api --tail 100',
        'vssh sdl myapp --verbose'
      ],
      handler: showLogsCommand,
      mcpName: 'show_docker_logs',
      inputSchema: ShowLogsArgsSchema
    },
    {
      name: 'list-docker-ports',
      aliases: ['ldp'],
      description: 'Show port mappings for containers',
      usage: 'vssh list-docker-ports [container-filter]',
      examples: [
        'vssh list-docker-ports',
        'vssh ldp web'
      ],
      handler: listPortsCommand,
      mcpName: 'list_docker_ports'
    },
    {
      name: 'list-docker-networks',
      aliases: ['ldn'],
      description: 'List all Docker networks',
      usage: 'vssh list-docker-networks',
      examples: [
        'vssh list-docker-networks',
        'vssh ldn'
      ],
      handler: listNetworksCommand,
      mcpName: 'list_docker_networks'
    },
    {
      name: 'show-docker-info',
      aliases: ['sdi'],
      description: 'Show comprehensive Docker system information',
      usage: 'vssh show-docker-info',
      examples: [
        'vssh show-docker-info',
        'vssh sdi'
      ],
      handler: showInfoCommand,
      mcpName: 'show_docker_info'
    }
  ],
  
  mcpTools: [
    {
      name: 'list_docker_containers',
      description: 'List all Docker containers on the remote server',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'get_docker_container',
      description: 'Find a single Docker container by name or ID pattern',
      inputSchema: {
        type: 'object',
        properties: {
          search_term: {
            type: 'string',
            description: 'Container name or ID to search for'
          },
          match_type: {
            type: 'string',
            enum: ['contains', 'startsWith', 'endsWith'],
            description: 'How to match the search term',
            default: 'contains'
          },
          return_name: {
            type: 'boolean',
            description: 'Return container name instead of ID',
            default: false
          }
        },
        required: ['search_term']
      }
    },
    {
      name: 'show_docker_logs',
      description: 'Show logs from one or more Docker containers',
      inputSchema: {
        type: 'object',
        properties: {
          containers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Container names or IDs'
          },
          tail: {
            type: 'number',
            description: 'Number of lines to show from the end',
            default: 50
          }
        },
        required: ['containers']
      }
    },
    {
      name: 'list_docker_ports',
      description: 'Show port mappings for Docker containers',
      inputSchema: {
        type: 'object',
        properties: {
          container_filter: {
            type: 'string',
            description: 'Optional filter for container names'
          }
        }
      }
    },
    {
      name: 'list_docker_networks',
      description: 'List all Docker networks',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'show_docker_info',
      description: 'Show comprehensive Docker system information including containers, images, volumes, and system resources',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ]
};

export default dockerPlugin;
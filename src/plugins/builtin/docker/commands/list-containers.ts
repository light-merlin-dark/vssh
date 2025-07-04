import { PluginContext, ParsedArgs, McpResponse } from '../../../types';
import { formatResponse, formatError } from '../../../response-utils';
import { DockerService } from '../services/docker-service';
import { ContainerHandler } from '../handlers/container-handler';
import { ListContainersArgsSchema } from '../types';

export async function listContainersCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const docker = new DockerService(context.sshService, context.proxyService);
  
  try {
    const containers = await docker.listContainers();
    
    if (containers.length === 0) {
      console.log('No containers found');
      return;
    }
    
    // Calculate column widths
    const idWidth = Math.max(12, ...containers.map(c => c.id.length));
    const nameWidth = Math.max(10, ...containers.map(c => c.name.length));
    const statusWidth = Math.max(10, ...containers.map(c => c.status.length));
    
    // Print header
    console.log(
      'CONTAINER ID'.padEnd(idWidth) + '  ' +
      'NAME'.padEnd(nameWidth) + '  ' +
      'STATUS'.padEnd(statusWidth)
    );
    console.log('-'.repeat(idWidth + nameWidth + statusWidth + 4));
    
    // Print containers
    for (const container of containers) {
      console.log(
        container.id.substring(0, 12).padEnd(idWidth) + '  ' +
        container.name.padEnd(nameWidth) + '  ' +
        container.status.padEnd(statusWidth)
      );
    }
  } catch (error: any) {
    context.logger.error(`Failed to list containers: ${error.message}`);
    process.exit(1);
  }
}

// New MCP-compatible handler that returns structured responses
export async function listContainersMcpHandler(
  context: PluginContext,
  args: ParsedArgs
): Promise<McpResponse> {
  const start = Date.now();
  const docker = new DockerService(context.sshService, context.proxyService);
  const handler = new ContainerHandler(docker);
  
  try {
    const containers = await handler.list(context, {
      limit: args.limit,
      filter: args.all ? {} : { status: 'running' }
    });
    
    return formatResponse(containers, {
      plugin: 'docker',
      command: 'list-containers',
      duration: Date.now() - start
    });
  } catch (error: any) {
    return formatError(error, {
      plugin: 'docker',
      command: 'list-containers',
      duration: Date.now() - start
    });
  }
}
import { PluginContext, ParsedArgs } from '../../../types';
import { DockerService } from '../services/docker-service';

export async function getContainerCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const searchTerm = args._[1];
  
  if (!searchTerm) {
    console.error('Error: Container name or pattern required');
    console.error('Usage: vssh get-docker-container <search-term> [--startsWith] [--endsWith] [--returnName]');
    process.exit(1);
  }
  
  const docker = new DockerService(context.sshService, context.proxyService);
  
  try {
    let matchType: 'contains' | 'startsWith' | 'endsWith' = 'contains';
    if (args.startsWith) matchType = 'startsWith';
    else if (args.endsWith) matchType = 'endsWith';
    
    const containers = await docker.findContainers(searchTerm, matchType);
    
    if (containers.length === 0) {
      console.error(`No container found matching: ${searchTerm}`);
      process.exit(1);
    }
    
    if (containers.length > 1) {
      console.error(`Multiple containers found matching: ${searchTerm}`);
      console.error('Found containers:');
      containers.forEach(c => console.error(`  - ${c.name} (${c.id})`));
      process.exit(1);
    }
    
    const container = containers[0];
    console.log(args.returnName ? container.name : container.id);
  } catch (error: any) {
    context.logger.error(`Failed to find container: ${error.message}`);
    process.exit(1);
  }
}
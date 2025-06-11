import { PluginContext, ParsedArgs } from '../../../types';
import { DockerService } from '../services/docker-service';

export async function listNetworksCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const docker = new DockerService(context.sshService, context.proxyService);
  
  try {
    const networks = await docker.listNetworks();
    
    if (networks.length === 0) {
      console.log('No networks found');
      return;
    }
    
    // Calculate column widths
    const idWidth = Math.max(12, ...networks.map(n => n.id.length));
    const nameWidth = Math.max(10, ...networks.map(n => n.name.length));
    const driverWidth = Math.max(10, ...networks.map(n => n.driver.length));
    const scopeWidth = Math.max(10, ...networks.map(n => n.scope.length));
    
    // Print header
    console.log(
      'NETWORK ID'.padEnd(idWidth) + '  ' +
      'NAME'.padEnd(nameWidth) + '  ' +
      'DRIVER'.padEnd(driverWidth) + '  ' +
      'SCOPE'.padEnd(scopeWidth)
    );
    console.log('-'.repeat(idWidth + nameWidth + driverWidth + scopeWidth + 6));
    
    // Print networks
    for (const network of networks) {
      console.log(
        network.id.substring(0, 12).padEnd(idWidth) + '  ' +
        network.name.padEnd(nameWidth) + '  ' +
        network.driver.padEnd(driverWidth) + '  ' +
        network.scope.padEnd(scopeWidth)
      );
    }
  } catch (error: any) {
    context.logger.error(`Failed to list networks: ${error.message}`);
    process.exit(1);
  }
}
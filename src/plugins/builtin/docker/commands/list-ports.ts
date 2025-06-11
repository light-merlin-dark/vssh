import { PluginContext, ParsedArgs } from '../../../types';
import { DockerService } from '../services/docker-service';

export async function listPortsCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const containerFilter = args._[1];
  const docker = new DockerService(context.sshService);
  
  try {
    let containers = await docker.listContainers();
    
    // Filter by container name if provided
    if (containerFilter) {
      containers = containers.filter(c => 
        c.name.toLowerCase().includes(containerFilter.toLowerCase())
      );
    }
    
    if (containers.length === 0) {
      console.log('No containers found');
      return;
    }
    
    // Group containers by running status
    const running = containers.filter(c => c.status.startsWith('Up'));
    const stopped = containers.filter(c => !c.status.startsWith('Up'));
    
    // Get port mappings
    console.log('🚢 Container Port Mappings');
    console.log('=' .repeat(80));
    
    if (running.length > 0) {
      console.log('\n🟢 Running Containers:');
      console.log('-'.repeat(80));
      
      await Promise.all(running.map(async (container) => {
        if (container.ports) {
          console.log(`\n${container.name} (${container.id.substring(0, 12)})`);
          // Parse and format ports
          const ports = container.ports.split(',').map(p => p.trim()).filter(p => p);
          if (ports.length > 0) {
            ports.forEach(port => {
              console.log(`  → ${port}`);
            });
          } else {
            console.log('  → No ports exposed');
          }
        } else {
          console.log(`\n${container.name} (${container.id.substring(0, 12)})`);
          console.log('  → No ports exposed');
        }
      }));
    }
    
    if (stopped.length > 0) {
      console.log('\n🔴 Stopped Containers:');
      console.log('-'.repeat(80));
      
      stopped.forEach(container => {
        console.log(`\n${container.name} (${container.id.substring(0, 12)}) - ${container.status}`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`Total: ${containers.length} containers (${running.length} running, ${stopped.length} stopped)`);
  } catch (error: any) {
    context.logger.error(`Failed to list ports: ${error.message}`);
    process.exit(1);
  }
}
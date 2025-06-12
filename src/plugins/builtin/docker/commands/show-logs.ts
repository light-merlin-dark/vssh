import { PluginContext, ParsedArgs } from '../../../types';
import { DockerService } from '../services/docker-service';

export async function showLogsCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const containers = args._.slice(1);
  
  if (containers.length === 0) {
    console.error('Error: At least one container name required');
    console.error('Usage: vssh show-docker-logs <container> [container2...] [--tail n] [--verbose]');
    process.exit(1);
  }
  
  const tail = args.tail || args.t || 50;
  const verbose = args.verbose || args.v || false;
  
  const docker = new DockerService(context.sshService, context.proxyService);
  
  
  if (verbose) {
    console.log(`🔍 Fetching logs for ${containers.length} container(s)...`);
  }
  
  const logPromises = containers.map(async (container) => {
    try {
      const logs = await docker.getContainerLogs(container, tail);
      return { container, logs, success: true };
    } catch (error: any) {
      return { container, error: error.message, success: false };
    }
  });
  
  const results = await Promise.allSettled(logPromises);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.success) {
      successCount++;
      const { container, logs } = result.value;
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📋 Logs for: ${container} (last ${tail} lines)`);
      console.log('='.repeat(80));
      console.log(logs);
    } else {
      failureCount++;
      const value = result.status === 'fulfilled' ? result.value : { container: 'unknown', error: result.reason };
      console.error(`\n❌ Failed to get logs for ${value.container}: ${value.error}`);
    }
  }
  
  if (verbose) {
    console.log(`\n📊 Summary: ${successCount} succeeded, ${failureCount} failed`);
  }
  
  if (failureCount > 0 && successCount === 0) {
    process.exit(1);
  }
}
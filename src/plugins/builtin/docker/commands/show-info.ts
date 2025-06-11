import { PluginContext, ParsedArgs } from '../../../types';
import { DockerService } from '../services/docker-service';

export async function showInfoCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const docker = new DockerService(context.sshService, context.proxyService);
  
  console.log('🔍 Gathering system information...');
  
  try {
    // Run all operations concurrently
    const [
      systemInfo,
      dockerStats,
      networks,
      diskUsage,
      memoryUsage,
      topContainers
    ] = await Promise.allSettled([
      docker.getSystemInfo(),
      docker.getDockerStats(),
      docker.listNetworks(),
      context.sshService.executeCommand('df -h / | tail -1'),
      context.sshService.executeCommand('free -h | grep Mem'),
      docker.getTopContainers()
    ]);
    
    console.log('\n📊 Docker System Information');
    console.log('=' .repeat(80));
    
    // Docker Info
    if (systemInfo.status === 'fulfilled') {
      const info = systemInfo.value;
      console.log('\n🐳 Docker Engine:');
      console.log(`  Version: ${info.ServerVersion}`);
      console.log(`  API Version: ${info.ApiVersion || 'N/A'}`);
      console.log(`  OS/Arch: ${info.OSType}/${info.Architecture}`);
      console.log(`  Storage Driver: ${info.Driver}`);
    }
    
    // Container Stats
    if (dockerStats.status === 'fulfilled') {
      const stats = dockerStats.value;
      console.log('\n📦 Containers:');
      console.log(`  Running: ${stats.containers.running}`);
      console.log(`  Stopped: ${stats.containers.stopped}`);
      console.log(`  Total: ${stats.containers.total}`);
      console.log(`\n🖼️  Images: ${stats.images}`);
      console.log(`💾 Volumes: ${stats.volumes}`);
    }
    
    // Networks
    if (networks.status === 'fulfilled') {
      console.log(`\n🌐 Networks: ${networks.value.length}`);
    }
    
    // System Resources
    console.log('\n💻 System Resources:');
    
    if (diskUsage.status === 'fulfilled') {
      const disk = diskUsage.value.trim().split(/\s+/);
      console.log(`  Disk Usage: ${disk[2]} of ${disk[1]} (${disk[4]})`);
    }
    
    if (memoryUsage.status === 'fulfilled') {
      const mem = memoryUsage.value.trim().split(/\s+/);
      const total = parseMemory(mem[1]);
      const used = parseMemory(mem[2]);
      const percent = ((used / total) * 100).toFixed(1);
      console.log(`  Memory: ${mem[2]} of ${mem[1]} (${percent}%)`);
    }
    
    // Top Containers
    if (topContainers.status === 'fulfilled' && topContainers.value.trim()) {
      console.log('\n🏃 Top Running Containers:');
      console.log(topContainers.value);
    }
    
    console.log('\n' + '='.repeat(80));
  } catch (error: any) {
    context.logger.error(`Failed to gather system info: ${error.message}`);
    process.exit(1);
  }
}

function parseMemory(memStr: string): number {
  const match = memStr.match(/^([\d.]+)([KMGT]?)i?$/);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2];
  
  const multipliers: { [key: string]: number } = {
    '': 1,
    'K': 1024,
    'M': 1024 * 1024,
    'G': 1024 * 1024 * 1024,
    'T': 1024 * 1024 * 1024 * 1024
  };
  
  return value * (multipliers[unit] || 1);
}
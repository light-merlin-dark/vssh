import { PluginContext, ParsedArgs } from '../../../types';

export async function getProxyConfigCommand(
  context: PluginContext,
  args: ParsedArgs
): Promise<void> {
  const proxyPath = '/data/coolify/proxy/docker-compose.yml';
  
  try {
    const result = await context.proxyService.executeCommand(`cat ${proxyPath}`, { skipLogging: true });
    console.log('🔧 Coolify Proxy Configuration');
    console.log('=' .repeat(80));
    console.log(result.output);
  } catch (error: any) {
    context.logger.error(`Failed to read proxy configuration: ${error.message}`);
    console.error('\nMake sure Coolify is installed and the proxy configuration exists.');
    process.exit(1);
  }
}
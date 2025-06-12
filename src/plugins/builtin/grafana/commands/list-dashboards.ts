import { PluginContext } from '../../../types';
import { ConfigService } from '../services/config-service';
import { GrafanaClient } from '../services/grafana-client';
import { DiscoveryService } from '../services/discovery-service';

export async function listDashboardsCommand(
  context: PluginContext,
  args: Record<string, any>
): Promise<void> {
  const configService = new ConfigService(context);
  
  // Load existing configuration
  let config = await configService.loadConfig();
  
  // If no config or test fails, run discovery
  if (!config || !(await configService.testConfig(config))) {
    context.logger.info('No valid Grafana configuration found. Running auto-discovery...');
    
    const discoveryService = new DiscoveryService(context);
    const discovery = await discoveryService.discoverGrafana();
    
    if (!discovery.found) {
      context.logger.error(`Grafana auto-discovery failed: ${discovery.error || 'Unknown error'}`);
      context.logger.info('\nPlease configure Grafana manually:');
      context.logger.info('  vssh grafana configure --url <URL> --username <USER> --password <PASS>');
      process.exit(1);
    }
    
    // Save discovered configuration
    config = {
      url: discovery.url!,
      username: discovery.username!,
      password: discovery.password!,
      containerName: discovery.containerName,
      lastUpdated: new Date().toISOString()
    };
    
    await configService.saveConfig(config);
    context.logger.info(`✅ Grafana discovered and configured successfully`);
    context.logger.info(`   Container: ${discovery.containerName}`);
    context.logger.info(`   URL: ${discovery.url}`);
    context.logger.info('');
  }
  
  // Create client and list dashboards
  const client = new GrafanaClient(context, config);
  
  try {
    const dashboards = await client.listDashboards();
    
    if (dashboards.length === 0) {
      console.log('No dashboards found');
      return;
    }
    
    // Display dashboards in a nice format
    console.log('\n📊 Grafana Dashboards\n');
    console.log('UID                              | Title                                    | Tags');
    console.log('-'.repeat(100));
    
    dashboards.forEach(dashboard => {
      const uid = dashboard.uid.padEnd(30);
      const title = dashboard.title.length > 40 
        ? dashboard.title.substring(0, 37) + '...' 
        : dashboard.title.padEnd(40);
      const tags = dashboard.tags?.join(', ') || '';
      
      console.log(`${uid} | ${title} | ${tags}`);
    });
    
    console.log(`\nTotal: ${dashboards.length} dashboard(s)`);
    console.log('\nTip: Use "vssh grafana view <search-term>" to view dashboard details');
    
  } catch (error: any) {
    context.logger.error(`Failed to list dashboards: ${error.message}`);
    process.exit(1);
  }
}
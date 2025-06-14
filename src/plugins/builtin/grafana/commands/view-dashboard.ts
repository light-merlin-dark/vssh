import { PluginContext } from '../../../types';
import { ConfigService } from '../services/config-service';
import { GrafanaClient } from '../services/grafana-client';

export async function viewDashboardCommand(
  context: PluginContext,
  args: Record<string, any>
): Promise<void> {
  // Extract search term with defensive fallbacks
  const [, rawTerm] = args._;
  const searchTerm = rawTerm || args.search || args.query;
  
  if (!searchTerm) {
    context.logger.error('Please provide a dashboard name or search term');
    context.logger.info('Usage: vssh grafana view <search-term>');
    context.logger.info('Examples:');
    context.logger.info('  vssh vgd "db metrics"');
    context.logger.info('  vssh vgd libsql');
    context.logger.info('  vssh vgd server');
    process.exit(1);
  }
  
  const configService = new ConfigService(context);
  const config = await configService.loadConfig();
  
  if (!config) {
    context.logger.error('No Grafana configuration found');
    context.logger.info('Run "vssh grafana list" first to configure Grafana');
    process.exit(1);
  }
  
  const client = new GrafanaClient(context, config);
  
  try {
    // Search for dashboards matching the term
    const dashboards = await client.searchDashboards(searchTerm);
    
    if (dashboards.length === 0) {
      console.log(`No dashboards found matching "${searchTerm}"\n`);
      
      // Show available dashboards instead
      console.log('Available dashboards:\n');
      const allDashboards = await client.listDashboards();
      
      if (allDashboards.length === 0) {
        console.log('No dashboards available');
        return;
      }
      
      // Group by folder for better organization
      const byFolder = new Map<string, typeof allDashboards>();
      
      for (const dashboard of allDashboards) {
        const folder = dashboard.folderTitle || 'General';
        if (!byFolder.has(folder)) {
          byFolder.set(folder, []);
        }
        byFolder.get(folder)!.push(dashboard);
      }
      
      // Display dashboards
      for (const [folder, dashboards] of byFolder) {
        if (folder !== 'General') {
          console.log(`📁 ${folder}`);
        }
        
        for (const dashboard of dashboards) {
          const tags = dashboard.tags && dashboard.tags.length > 0 ? ` [${dashboard.tags.join(', ')}]` : '';
          console.log(`  • ${dashboard.title} (${dashboard.uid})${tags}`);
        }
        
        console.log();
      }
      
      console.log('💡 Try searching with a partial name or UID from the list above');
      return;
    }
    
    if (dashboards.length > 1) {
      console.log(`\nMultiple dashboards found matching "${searchTerm}":\n`);
      dashboards.forEach((dashboard, index) => {
        console.log(`${index + 1}. ${dashboard.title} (${dashboard.uid})`);
      });
      console.log('\nPlease be more specific or use the exact UID');
      return;
    }
    
    // Get detailed information about the dashboard
    const dashboard = dashboards[0];
    const details = await client.getDashboard(dashboard.uid);
    
    console.log('\n📊 Dashboard Details\n');
    console.log(`Title:       ${details.title}`);
    console.log(`UID:         ${details.uid}`);
    console.log(`URL:         ${config.url}${dashboard.url}`);
    
    if (details.description) {
      console.log(`Description: ${details.description}`);
    }
    
    console.log(`Version:     ${details.version}`);
    console.log(`Panels:      ${details.panels}`);
    console.log(`Variables:   ${details.variables}`);
    
    if (details.tags && details.tags.length > 0) {
      console.log(`Tags:        ${details.tags.join(', ')}`);
    }
    
    if (details.created) {
      console.log(`Created:     ${new Date(details.created).toLocaleString()}`);
      if (details.createdBy) {
        console.log(`Created By:  ${details.createdBy}`);
      }
    }
    
    if (details.updated) {
      console.log(`Updated:     ${new Date(details.updated).toLocaleString()}`);
      if (details.updatedBy) {
        console.log(`Updated By:  ${details.updatedBy}`);
      }
    }
    
    console.log('\n💡 To view this dashboard in Grafana:');
    console.log(`   ${config.url}${dashboard.url}`);
    
  } catch (error: any) {
    context.logger.error(`Failed to view dashboard: ${error.message}`);
    process.exit(1);
  }
}
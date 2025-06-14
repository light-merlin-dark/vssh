import { VsshPlugin } from '../../types';
import { listDashboardsCommand } from './commands/list-dashboards';
import { viewDashboardCommand } from './commands/view-dashboard';

const grafanaPlugin: VsshPlugin = {
  name: 'grafana',
  version: '1.0.0',
  description: 'Grafana dashboard discovery and viewing',
  
  mcpContext: {
    section: 'GRAFANA COMMANDS',
    commands: [
      { command: 'vssh lgd', description: 'List all dashboards' },
      { command: 'vssh vgd "db metrics"', description: 'View dashboard (partial match)' },
      { command: 'vssh vgd libsql', description: 'View LibSQL dashboard' },
      { command: 'vssh vgd server', description: 'View server dashboard' }
    ]
  },
  commands: [
    {
      name: 'list-grafana-dashboards',
      description: 'List all available Grafana dashboards',
      usage: 'vssh grafana list',
      handler: listDashboardsCommand,
      aliases: ['lgd'],
      mcpName: 'list_grafana_dashboards'
    },
    {
      name: 'view-grafana-dashboard',
      description: 'View details of a Grafana dashboard by name, UID, or partial match',
      usage: 'vssh grafana view <search-term>',
      handler: viewDashboardCommand,
      aliases: ['vgd'],
      mcpName: 'view_grafana_dashboard'
    }
  ]
};

export default grafanaPlugin;
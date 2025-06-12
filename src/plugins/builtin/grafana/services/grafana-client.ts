import { PluginContext } from '../../../types';
import { GrafanaConfig } from './config-service';

export interface GrafanaDashboard {
  uid: string;
  title: string;
  url: string;
  tags?: string[];
  folderTitle?: string;
  isStarred?: boolean;
}

export interface GrafanaDashboardDetails {
  uid: string;
  title: string;
  description?: string;
  tags?: string[];
  version: number;
  panels: number;
  variables: number;
  created?: string;
  updated?: string;
  createdBy?: string;
  updatedBy?: string;
}

export class GrafanaClient {
  constructor(
    private context: PluginContext,
    private config: GrafanaConfig
  ) {}

  async listDashboards(): Promise<GrafanaDashboard[]> {
    try {
      const internalUrl = this.getInternalUrl();
      const command = `curl -s -u ${this.config.username}:${this.config.password} "${internalUrl}/api/search?type=dash-db" | jq '.'`;
      
      const result = await this.context.sshService.executeCommand(command);
      const dashboards = JSON.parse(result);

      return dashboards.map((dashboard: any) => ({
        uid: dashboard.uid,
        title: dashboard.title,
        url: dashboard.url,
        tags: dashboard.tags || [],
        folderTitle: dashboard.folderTitle,
        isStarred: dashboard.isStarred || false
      }));
    } catch (error: any) {
      throw new Error(`Failed to list dashboards: ${error.message}`);
    }
  }

  async getDashboard(uid: string): Promise<GrafanaDashboardDetails> {
    try {
      const internalUrl = this.getInternalUrl();
      const command = `curl -s -u ${this.config.username}:${this.config.password} "${internalUrl}/api/dashboards/uid/${uid}" | jq '.'`;
      
      const result = await this.context.sshService.executeCommand(command);
      const response = JSON.parse(result);
      
      if (!response.dashboard) {
        throw new Error('Dashboard not found');
      }

      const dashboard = response.dashboard;
      const meta = response.meta || {};

      return {
        uid: dashboard.uid,
        title: dashboard.title,
        description: dashboard.description,
        tags: dashboard.tags || [],
        version: meta.version || dashboard.version || 1,
        panels: dashboard.panels?.length || 0,
        variables: dashboard.templating?.list?.length || 0,
        created: meta.created,
        updated: meta.updated,
        createdBy: meta.createdBy,
        updatedBy: meta.updatedBy
      };
    } catch (error: any) {
      throw new Error(`Failed to get dashboard: ${error.message}`);
    }
  }

  async searchDashboards(query: string): Promise<GrafanaDashboard[]> {
    const allDashboards = await this.listDashboards();
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);

    return allDashboards.filter(dashboard => {
      const searchableText = [
        dashboard.title.toLowerCase(),
        ...(dashboard.tags?.map(tag => tag.toLowerCase()) || []),
        dashboard.folderTitle?.toLowerCase() || ''
      ].join(' ');

      // Check if all words in the query are found in the searchable text
      return queryWords.every(word => searchableText.includes(word));
    });
  }

  private getInternalUrl(): string {
    // Extract internal URL if the config URL is external
    if (this.config.url.includes('172.') || this.config.url.includes('10.') || this.config.url.includes('192.168.')) {
      return this.config.url;
    }

    // For external URLs, we need to use the container's internal IP
    // This should be handled during discovery
    const urlMatch = this.config.url.match(/https?:\/\/[^:\/]+(:(\d+))?/);
    const port = urlMatch && urlMatch[2] ? urlMatch[2] : '3000';
    
    // If we have container name, we can try to get its current IP
    if (this.config.containerName) {
      // This would require another discovery, for now use stored URL
      return this.config.url;
    }

    return this.config.url;
  }
}
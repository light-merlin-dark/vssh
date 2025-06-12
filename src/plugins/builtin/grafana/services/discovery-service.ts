import { PluginContext } from '../../../types';

export interface GrafanaDiscoveryResult {
  found: boolean;
  url?: string;
  username?: string;
  password?: string;
  containerName?: string;
  error?: string;
}

export class DiscoveryService {
  constructor(private context: PluginContext) {}

  async discoverGrafana(): Promise<GrafanaDiscoveryResult> {
    try {
      // Step 1: Find Grafana containers
      const containers = await this.findGrafanaContainers();
      if (containers.length === 0) {
        return {
          found: false,
          error: 'No Grafana containers found'
        };
      }

      // Step 2: Try each container to find working credentials
      for (const container of containers) {
        const result = await this.tryContainer(container);
        if (result.found) {
          return result;
        }
      }

      return {
        found: false,
        error: 'Found Grafana containers but could not extract working credentials'
      };
    } catch (error: any) {
      return {
        found: false,
        error: `Discovery failed: ${error.message}`
      };
    }
  }

  private async findGrafanaContainers(): Promise<string[]> {
    try {
      const listCommand = 'docker ps --format "{{.Names}}" | grep -i grafana || true';
      const result = await this.context.sshService.executeCommand(listCommand);
      
      if (!result || !result.trim()) {
        return [];
      }

      return result.trim().split('\n').filter(name => name.length > 0);
    } catch (error) {
      this.context.logger.debug(`Failed to list containers: ${error}`);
      return [];
    }
  }

  private async tryContainer(containerName: string): Promise<GrafanaDiscoveryResult> {
    try {
      // Get container details
      const inspectCommand = `docker inspect ${containerName} --format '{{json .}}'`;
      const inspectResult = await this.context.sshService.executeCommand(inspectCommand);
      const containerInfo = JSON.parse(inspectResult);

      // Extract environment variables
      const env = containerInfo.Config?.Env || [];
      const envMap: Record<string, string> = {};
      
      env.forEach((envVar: string) => {
        const [key, ...valueParts] = envVar.split('=');
        if (key) {
          envMap[key] = valueParts.join('=');
        }
      });

      // Look for Grafana credentials
      const username = envMap['GF_SECURITY_ADMIN_USER'] || 'admin';
      const password = envMap['GF_SECURITY_ADMIN_PASSWORD'] || envMap['GRAFANA_ADMIN_PASSWORD'];
      
      if (!password) {
        this.context.logger.debug(`No password found in environment for container ${containerName}`);
        return { found: false };
      }

      // Get container IP
      const networks = containerInfo.NetworkSettings?.Networks || {};
      let containerIp: string | null = null;
      
      // Try to find the best network (prefer non-bridge networks)
      for (const [networkName, network] of Object.entries(networks)) {
        if (network && (network as any).IPAddress) {
          containerIp = (network as any).IPAddress;
          if (networkName !== 'bridge') {
            break; // Prefer non-bridge networks
          }
        }
      }

      if (!containerIp) {
        this.context.logger.debug(`No IP address found for container ${containerName}`);
        return { found: false };
      }

      // Determine URL
      const port = this.extractPort(envMap, containerInfo);
      const baseUrl = envMap['GF_SERVER_ROOT_URL'] || `http://${containerIp}:${port}`;
      const internalUrl = `http://${containerIp}:${port}`;

      // Test connection
      const testCommand = `curl -s -f -u ${username}:${password} ${internalUrl}/api/org || echo "FAILED"`;
      const testResult = await this.context.sshService.executeCommand(testCommand);

      if (testResult.includes('FAILED')) {
        this.context.logger.debug(`Failed to connect to Grafana at ${internalUrl}`);
        return { found: false };
      }

      return {
        found: true,
        url: baseUrl,
        username,
        password,
        containerName
      };
    } catch (error: any) {
      this.context.logger.debug(`Failed to inspect container ${containerName}: ${error}`);
      return { found: false };
    }
  }

  private extractPort(envMap: Record<string, string>, containerInfo: any): string {
    // Check environment variable
    if (envMap['GF_SERVER_HTTP_PORT']) {
      return envMap['GF_SERVER_HTTP_PORT'];
    }

    // Check exposed ports
    const exposedPorts = containerInfo.Config?.ExposedPorts || {};
    for (const port of Object.keys(exposedPorts)) {
      if (port.includes('3000')) {
        return '3000';
      }
    }

    // Default Grafana port
    return '3000';
  }
}
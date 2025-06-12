import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { encryption } from '../../../../services/encryption';
import { PluginContext } from '../../../types';

export interface GrafanaConfig {
  url: string;
  username: string;
  password: string;
  containerName?: string;
  lastUpdated: string;
}

export class ConfigService {
  private configPath: string;

  constructor(private context: PluginContext) {
    const configDir = process.env.VSSH_CONFIG_DIR || path.join(os.homedir(), '.vssh');
    this.configPath = path.join(configDir, 'plugins', 'grafana.enc');
  }

  async loadConfig(): Promise<GrafanaConfig | null> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const encryptedData = fs.readFileSync(this.configPath, 'utf8');
      const config = encryption.decryptObject<GrafanaConfig>(encryptedData);
      
      // Validate config structure
      if (!config.url || !config.username || !config.password) {
        this.context.logger.warn('Invalid Grafana configuration found');
        return null;
      }

      return config;
    } catch (error: any) {
      this.context.logger.error(`Failed to load Grafana configuration: ${error.message}`);
      return null;
    }
  }

  async saveConfig(config: GrafanaConfig): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      // Add timestamp
      config.lastUpdated = new Date().toISOString();

      // Encrypt and save
      const encryptedData = encryption.encryptObject(config);
      fs.writeFileSync(this.configPath, encryptedData, {
        mode: 0o600 // Read/write for owner only
      });

      this.context.logger.info('Grafana configuration saved successfully');
    } catch (error: any) {
      throw new Error(`Failed to save Grafana configuration: ${error.message}`);
    }
  }

  async clearConfig(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        fs.unlinkSync(this.configPath);
        this.context.logger.info('Grafana configuration cleared');
      }
    } catch (error: any) {
      this.context.logger.error(`Failed to clear configuration: ${error.message}`);
    }
  }

  /**
   * Test if the stored configuration is still valid
   */
  async testConfig(config: GrafanaConfig): Promise<boolean> {
    try {
      // For internal URLs, we need to test through SSH
      if (config.url.includes('172.') || config.url.includes('10.') || config.url.includes('192.168.')) {
        // Extract IP and port from URL
        const urlMatch = config.url.match(/https?:\/\/([\d.]+):(\d+)/);
        if (!urlMatch) {
          return false;
        }
        
        const [, ip, port] = urlMatch;
        const testCommand = `curl -s -f -u ${config.username}:${config.password} http://${ip}:${port}/api/org || echo "FAILED"`;
        const result = await this.context.sshService.executeCommand(testCommand);
        
        return !result.includes('FAILED');
      } else {
        // For external URLs, we can test directly (if needed in future)
        // For now, assume external URLs are valid
        return true;
      }
    } catch (error) {
      return false;
    }
  }
}
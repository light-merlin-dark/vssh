import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockContext, captureOutput } from '@vssh/test-utils';
import { PluginCommand } from '../../../types';
import grafanaPlugin from '../index';
import fixtures from './fixtures/grafana-responses.json';
import * as fs from 'fs';

// Mock the fs module
vi.mock('fs');

// Mock the encryption service
vi.mock('../../../../services/encryption', () => ({
  encryption: {
    encryptObject: vi.fn((obj: any) => JSON.stringify(obj)),
    decryptObject: vi.fn((str: string) => JSON.parse(str))
  }
}));

// Store original process.exit
const originalExit = process.exit;

// Mock process.exit globally to prevent test termination
beforeEach(() => {
  process.exit = vi.fn() as any;
});

afterEach(() => {
  process.exit = originalExit;
});

describe('Grafana Plugin', () => {
  it('should have correct plugin metadata', () => {
    expect(grafanaPlugin.name).toBe('grafana');
    expect(grafanaPlugin.version).toBe('1.0.0');
    expect(grafanaPlugin.description).toBe('Grafana dashboard discovery and viewing');
  });
  
  it('should export 2 commands', () => {
    expect(grafanaPlugin.commands).toHaveLength(2);
    
    const commandNames = grafanaPlugin.commands.map((cmd: PluginCommand) => cmd.name);
    expect(commandNames).toContain('list-grafana-dashboards');
    expect(commandNames).toContain('view-grafana-dashboard');
  });
  
  it('should have proper aliases', () => {
    const aliasMap = new Map<string, string>();
    
    grafanaPlugin.commands.forEach((cmd: PluginCommand) => {
      if (cmd.aliases) {
        cmd.aliases.forEach((alias: string) => {
          aliasMap.set(alias, cmd.name);
        });
      }
    });
    
    expect(aliasMap.get('lgd')).toBe('list-grafana-dashboards');
    expect(aliasMap.get('vgd')).toBe('view-grafana-dashboard');
  });
});

describe('list-grafana-dashboards command', () => {
  let context: any;
  let mockSSH: any;
  let mockFS: any;
  
  beforeEach(() => {
    ({ context, mockSSH } = createMockContext());
    mockFS = fs as any;
    
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock file system operations
    mockFS.existsSync = vi.fn();
    mockFS.readFileSync = vi.fn();
    mockFS.writeFileSync = vi.fn();
    mockFS.mkdirSync = vi.fn();
    
    // Reset process.exit mock
    (process.exit as any).mockClear();
  });
  
  it('should perform auto-discovery when no config exists', async () => {
    // No existing config
    mockFS.existsSync.mockReturnValue(false);
    
    // Mock directory creation
    mockFS.mkdirSync.mockImplementation(() => {});
    mockFS.writeFileSync.mockImplementation(() => {});
    
    // Mock discovery process - fix the output format (no double backslash)
    mockSSH.setResponse(
      'docker ps --format "{{.Names}}" | grep -i grafana || true',
      'grafana-test-container\ngrafana-prod-container'
    );
    
    // Mock container inspection - note the single quotes need to match exactly
    mockSSH.setResponse(
      `docker inspect grafana-test-container --format '{{json .}}'`,
      JSON.stringify(fixtures.containerInspect)
    );
    
    // Mock API test
    mockSSH.setResponse(
      'curl -s -f -u admin:secretPassword123 http://172.18.0.10:3000/api/org || echo "FAILED"',
      JSON.stringify(fixtures.orgResponse)
    );
    
    // Mock dashboard list - use the extracted URL from config
    mockSSH.setResponse(
      `curl -s -u admin:secretPassword123 "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      JSON.stringify(fixtures.listDashboards)
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'list-grafana-dashboards');
    
    const { stdout, stderr } = await captureOutput(async () => {
      try {
        await command!.handler(context, { _: [] });
      } catch (error) {
        // Ignore errors since process.exit is mocked
      }
    });
    
    // Check discovery was performed (via logger)
    const logs = context.logger.getLogs();
    expect(logs.info.some((log: any[]) => log[0].includes('auto-discovery'))).toBe(true);
    expect(logs.info.some((log: any[]) => log[0].includes('Grafana discovered and configured successfully'))).toBe(true);
    
    // Check dashboards were listed (via stdout)
    expect(stdout).toContain('Grafana Dashboards');
    expect(stdout).toContain('DB Platform Metrics v1.0.0');
    expect(stdout).toContain('Metrics Agent Example v1.0.0');
    expect(stdout).toContain('Test Dashboard');
    expect(stdout).toContain('Total: 3 dashboard(s)');
    
    // Verify config was saved
    expect(mockFS.writeFileSync).toHaveBeenCalled();
    
    // Should not call process.exit on success for listing
    expect(process.exit).not.toHaveBeenCalled();
  });
  
  it('should use existing config when available', async () => {
    // Mock existing config
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify({
      url: 'https://grafana.example.com',
      username: 'admin',
      password: 'existingPassword',
      lastUpdated: '2024-01-01T00:00:00Z'
    }));
    
    // For external URLs, the testConfig returns true without SSH call
    // No need to mock SSH call for external URL test
    
    // Mock dashboard list
    mockSSH.setResponse(
      `curl -s -u admin:existingPassword "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      JSON.stringify(fixtures.listDashboards)
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'list-grafana-dashboards');
    const { stdout } = await captureOutput(async () => {
      await command!.handler(context, { _: [] });
    });
    
    // Should not show discovery message
    expect(stdout).not.toContain('Running auto-discovery');
    
    // Check dashboards were listed
    expect(stdout).toContain('Grafana Dashboards');
    expect(stdout).toContain('Total: 3 dashboard(s)');
  });
  
  it('should handle empty dashboard list', async () => {
    // Mock existing config
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify({
      url: 'https://grafana.example.com',
      username: 'admin',
      password: 'password',
      lastUpdated: '2024-01-01T00:00:00Z'
    }));
    
    // Mock empty dashboard list
    mockSSH.setResponse(
      `curl -s -u admin:password "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      '[]'
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'list-grafana-dashboards');
    const { stdout } = await captureOutput(async () => {
      await command!.handler(context, { _: [] });
    });
    
    expect(stdout).toContain('No dashboards found');
  });
});

describe('view-grafana-dashboard command', () => {
  let context: any;
  let mockSSH: any;
  let mockFS: any;
  
  beforeEach(() => {
    ({ context, mockSSH } = createMockContext());
    mockFS = fs as any;
    
    vi.clearAllMocks();
    
    // Mock existing config - the ConfigService uses encryption
    mockFS.existsSync = vi.fn().mockImplementation((path: string) => {
      // Return true for the grafana.enc config file
      return path.includes('grafana.enc');
    });
    
    // Mock encrypted config data
    const mockConfig = {
      url: 'https://grafana.example.com',
      username: 'admin',
      password: 'password',
      lastUpdated: '2024-01-01T00:00:00Z'
    };
    
    // The config is encrypted, so we need to return the encrypted string
    // Since we mocked encryption to just stringify, we can return the stringified config
    mockFS.readFileSync = vi.fn().mockReturnValue(JSON.stringify(mockConfig));
    mockFS.writeFileSync = vi.fn();
    mockFS.mkdirSync = vi.fn();
    
    // Reset process.exit mock
    (process.exit as any).mockClear();
  });
  
  it('should find and display dashboard by partial name match', async () => {
    // The GrafanaClient will use the internal URL from config
    // Since the mock config has 'https://grafana.example.com', it will use that URL
    mockSSH.setResponse(
      `curl -s -u admin:password "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      JSON.stringify(fixtures.listDashboards)
    );
    
    // Mock dashboard details
    mockSSH.setResponse(
      `curl -s -u admin:password "https://grafana.example.com/api/dashboards/uid/merlin-db-metrics-dashboard" | jq '.'`,
      JSON.stringify(fixtures.dashboardDetails)
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'view-grafana-dashboard');
    const { stdout } = await captureOutput(async () => {
      await command!.handler(context, { _: ['view-grafana-dashboard', 'db metrics'] });
    });
    
    // Check dashboard details
    expect(stdout).toContain('Dashboard Details');
    expect(stdout).toContain('DB Platform Metrics v1.0.0');
    expect(stdout).toContain('merlin-db-metrics-dashboard');
    expect(stdout).toContain('Panels:      6');
    expect(stdout).toContain('Variables:   2');
    expect(stdout).toContain('database, metrics, production');
  });
  
  it('should handle no search term provided', async () => {
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'view-grafana-dashboard');
    
    await command!.handler(context, { _: [] });
    
    expect(process.exit).toHaveBeenCalledWith(1);
    const errorLogs = context.logger.getLogs().error;
    expect(errorLogs[0][0]).toContain('Please provide a dashboard name');
  });
  
  it('should show multiple matches when search is ambiguous', async () => {
    // Mock dashboard search - return all dashboards for 'metrics'
    mockSSH.setResponse(
      `curl -s -u admin:password "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      JSON.stringify(fixtures.listDashboards)
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'view-grafana-dashboard');
    const { stdout } = await captureOutput(async () => {
      await command!.handler(context, { _: ['view-grafana-dashboard', 'metrics'] });
    });
    
    expect(stdout).toContain('Multiple dashboards found');
    expect(stdout).toContain('1. DB Platform Metrics v1.0.0');
    expect(stdout).toContain('2. Metrics Agent Example v1.0.0');
    expect(stdout).toContain('Please be more specific');
  });
  
  it('should handle no matches found', async () => {
    // Mock search result
    mockSSH.setResponse(
      `curl -s -u admin:password "https://grafana.example.com/api/search?type=dash-db" | jq '.'`,
      JSON.stringify(fixtures.listDashboards)
    );
    
    const command = grafanaPlugin.commands.find((cmd: PluginCommand) => cmd.name === 'view-grafana-dashboard');
    const { stdout } = await captureOutput(async () => {
      await command!.handler(context, { _: ['view-grafana-dashboard', 'nonexistent'] });
    });
    
    expect(stdout).toContain('No dashboards found matching "nonexistent"');
  });
});
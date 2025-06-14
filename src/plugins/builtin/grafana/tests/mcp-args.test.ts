import { describe, it, expect, vi, beforeEach } from 'vitest';
import { viewDashboardCommand } from '../commands/view-dashboard';
import { PluginContext } from '../../../types';
import { GrafanaClient } from '../services/grafana-client';
import { ConfigService } from '../services/config-service';

// Mock the services
vi.mock('../services/grafana-client');
vi.mock('../services/config-service');

describe('MCP argument handling', () => {
  let mockContext: PluginContext;
  let mockConfigService: any;
  let mockGrafanaClient: any;

  beforeEach(() => {
    mockContext = {
      logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      }
    } as any;

    mockConfigService = {
      loadConfig: vi.fn().mockResolvedValue({
        url: 'https://grafana.example.com',
        username: 'test',
        password: 'test'
      })
    };

    mockGrafanaClient = {
      searchDashboards: vi.fn().mockResolvedValue([{
        uid: 'test-dashboard',
        title: 'Test Dashboard',
        url: '/d/test-dashboard'
      }]),
      getDashboard: vi.fn().mockResolvedValue({
        uid: 'test-dashboard',
        title: 'Test Dashboard',
        version: 1,
        panels: 5,
        variables: 2
      })
    };

    vi.mocked(ConfigService).mockImplementation(() => mockConfigService);
    vi.mocked(GrafanaClient).mockImplementation(() => mockGrafanaClient);
  });

  it('passes positional args through MCP unchanged', async () => {
    // Simulate MCP call structure: command name at _[0], search term at _[1]
    const mcpArgs = {
      _: ['view-grafana-dashboard', 'libsql']
    };

    await viewDashboardCommand(mockContext, mcpArgs);

    expect(mockGrafanaClient.searchDashboards).toHaveBeenCalledWith('libsql');
  });

  it('handles CLI call structure', async () => {
    // Simulate CLI call structure: alias at _[0], search term at _[1]
    const cliArgs = {
      _: ['vgd', 'libsql']
    };

    await viewDashboardCommand(mockContext, cliArgs);

    expect(mockGrafanaClient.searchDashboards).toHaveBeenCalledWith('libsql');
  });

  it('falls back to named arguments', async () => {
    // Test fallback to search property
    const namedArgs = {
      _: ['view-grafana-dashboard'],
      search: 'libsql'
    };

    await viewDashboardCommand(mockContext, namedArgs);

    expect(mockGrafanaClient.searchDashboards).toHaveBeenCalledWith('libsql');
  });

  it('falls back to query argument', async () => {
    // Test fallback to query property
    const namedArgs = {
      _: ['view-grafana-dashboard'],
      query: 'libsql'
    };

    await viewDashboardCommand(mockContext, namedArgs);

    expect(mockGrafanaClient.searchDashboards).toHaveBeenCalledWith('libsql');
  });

  it('throws error when no search term provided', async () => {
    const emptyArgs = {
      _: ['view-grafana-dashboard']
    };

    const consoleSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(viewDashboardCommand(mockContext, emptyArgs)).rejects.toThrow('process.exit called');
    
    expect(mockContext.logger.error).toHaveBeenCalledWith('Please provide a dashboard name or search term');
    
    consoleSpy.mockRestore();
  });
});
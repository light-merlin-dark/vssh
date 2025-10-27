import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { PluginRegistry } from '../../../src/plugins/registry';
import { VsshPlugin } from '../../../src/plugins/types';
import { createMockSSHService } from '../../test-utils/mock-ssh-service';
import { CommandGuardService } from '../../../src/services/command-guard-service';
import { ProxyService } from '../../../src/services/proxy-service';

// Mock the saveConfig function
mock.module('../../../src/config', () => ({
  saveConfig: mock()
}));

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockSSH: any;
  let commandGuard: CommandGuardService;
  let proxyService: ProxyService;
  let config: any;
  let logger: any;
  
  beforeEach(() => {
    mockSSH = createMockSSHService();
    commandGuard = new CommandGuardService();
    proxyService = new ProxyService({} as any, mockSSH, commandGuard);
    config = {
      host: 'test',
      user: 'test',
      keyPath: '/test',
      plugins: { enabled: [] }
    };
    logger = {
      info: mock(),
      warn: mock(),
      error: mock(),
      debug: mock()
    };
    
    registry = new PluginRegistry(mockSSH, commandGuard, config, logger, proxyService);
  });
  
  describe('Plugin Loading', () => {
    it('should load a plugin successfully', async () => {
      const plugin: VsshPlugin = {
        name: 'test',
        version: '1.0.0',
        description: 'Test plugin',
        commands: []
      };
      
      await registry.loadPlugin(plugin);
      
      expect(registry.getPlugin('test')).toBe(plugin);
    });
    
    it('should prevent duplicate plugin loading', async () => {
      const plugin: VsshPlugin = {
        name: 'test',
        version: '1.0.0',
        description: 'Test plugin',
        commands: []
      };
      
      await registry.loadPlugin(plugin);
      await expect(registry.loadPlugin(plugin)).rejects.toThrow('already loaded');
    });
  });
  
  describe('Plugin Enable/Disable', () => {
    it('should enable and disable plugins', async () => {
      const plugin: VsshPlugin = {
        name: 'test',
        version: '1.0.0',
        description: 'Test plugin',
        commands: []
      };
      
      await registry.loadPlugin(plugin);
      expect(registry.isEnabled('test')).toBe(false);
      
      await registry.enablePlugin('test');
      expect(registry.isEnabled('test')).toBe(true);
      
      await registry.disablePlugin('test');
      expect(registry.isEnabled('test')).toBe(false);
    });
  });
  
  describe('Runtime Dependencies', () => {
    it('should check runtime dependencies before executing commands', async () => {
      const mockHandler = mock();
      const plugin: VsshPlugin = {
        name: 'test-deps',
        version: '1.0.0',
        description: 'Test plugin with dependencies',
        runtimeDependencies: [
          {
            command: 'docker',
            displayName: 'Docker',
            checkCommand: 'which docker',
            installHint: 'Install Docker from docker.com'
          }
        ],
        commands: [{
          name: 'test-command',
          description: 'Test command',
          usage: 'test-command',
          handler: mockHandler
        }]
      };
      
      // Mock SSH to return empty (command not found)
      mockSSH.setResponse('which docker', '');
      
      await registry.loadPlugin(plugin);
      await registry.enablePlugin('test-deps');
      
      // Mock process.exit to prevent test from exiting
      const mockExit = spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });
      
      // Executing command should fail due to missing dependency
      await expect(registry.executeCommand('test-command', { _: [] }))
        .rejects.toThrow('Process exit');
      
      expect(mockHandler).not.toHaveBeenCalled();
      mockExit.mockRestore();
    });
    
    it('should execute command when dependencies are satisfied', async () => {
      const mockHandler = mock();
      const plugin: VsshPlugin = {
        name: 'test-deps',
        version: '1.0.0',
        description: 'Test plugin with dependencies',
        runtimeDependencies: [
          {
            command: 'docker',
            displayName: 'Docker',
            checkCommand: 'which docker',
            installHint: 'Install Docker from docker.com'
          }
        ],
        commands: [{
          name: 'test-command',
          description: 'Test command',
          usage: 'test-command',
          handler: mockHandler
        }]
      };
      
      // Mock SSH to return path (command found)
      mockSSH.setResponse('which docker', '/usr/bin/docker');
      
      await registry.loadPlugin(plugin);
      await registry.enablePlugin('test-deps');
      
      await registry.executeCommand('test-command', { _: [] });
      
      expect(mockHandler).toHaveBeenCalled();
    });
  });
});
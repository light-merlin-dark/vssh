import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '../../../src/plugins/registry';
import { VsshPlugin } from '../../../src/plugins/types';
import { createMockSSHService } from '../../test-utils/mock-ssh-service';
import { CommandGuardService } from '../../../src/services/command-guard-service';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;
  let mockSSH: any;
  let commandGuard: CommandGuardService;
  let config: any;
  let logger: any;
  
  beforeEach(() => {
    mockSSH = createMockSSHService();
    commandGuard = new CommandGuardService();
    config = {
      host: 'test',
      user: 'test',
      keyPath: '/test',
      plugins: { enabled: [] }
    };
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    };
    
    registry = new PluginRegistry(mockSSH, commandGuard, config, logger);
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
});
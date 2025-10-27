import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { DependencyChecker } from '../../../src/services/dependency-checker';
import { SSHService } from '../../../src/services/ssh';
import { ProxyService } from '../../../src/services/proxy-service';
import { RuntimeDependency, VsshPlugin } from '../../../src/plugins/types';

describe('DependencyChecker', () => {
  let checker: DependencyChecker;
  let mockSSH: any;
  let mockProxy: any;
  
  beforeEach(() => {
    mockSSH = {
      executeCommand: mock()
    } as any;
    
    mockProxy = {
      executeCommand: mock()
    } as any;
  });
  
  describe('Local Execution', () => {
    beforeEach(() => {
      checker = new DependencyChecker(mockSSH, mockProxy, true);
    });
    
    it('should check dependencies locally', async () => {
      mockSSH.executeCommand.mockResolvedValue('/usr/bin/docker');
      
      const dependency: RuntimeDependency = {
        command: 'docker',
        displayName: 'Docker',
        checkCommand: 'which docker'
      };
      
      const result = await checker.checkDependency(dependency);
      
      expect(result.isAvailable).toBe(true);
      expect(mockSSH.executeCommand).toHaveBeenCalledWith('which docker');
      expect(mockProxy.executeCommand).not.toHaveBeenCalled();
    });
    
    it('should handle missing dependencies locally', async () => {
      mockSSH.executeCommand.mockResolvedValue('');
      
      const dependency: RuntimeDependency = {
        command: 'fakecli',
        displayName: 'FakeCLI',
        installHint: 'Install with npm install -g fakecli'
      };
      
      const result = await checker.checkDependency(dependency);
      
      expect(result.isAvailable).toBe(false);
      expect(result.error).toContain('FakeCLI is not installed locally');
      expect(result.error).toContain('Install with npm install -g fakecli');
    });
  });
  
  describe('Remote Execution', () => {
    beforeEach(() => {
      checker = new DependencyChecker(mockSSH, mockProxy, false);
    });
    
    it('should check dependencies on remote server', async () => {
      mockProxy.executeCommand.mockResolvedValue({ 
        output: '/usr/bin/docker',
        error: '',
        exitCode: 0
      });
      
      const dependency: RuntimeDependency = {
        command: 'docker',
        displayName: 'Docker'
      };
      
      const result = await checker.checkDependency(dependency);
      
      expect(result.isAvailable).toBe(true);
      expect(mockProxy.executeCommand).toHaveBeenCalledWith('which docker', { skipLogging: true });
      expect(mockSSH.executeCommand).not.toHaveBeenCalled();
    });
    
    it('should handle missing dependencies on server', async () => {
      mockProxy.executeCommand.mockResolvedValue({ 
        output: '',
        error: '',
        exitCode: 1
      });
      
      const dependency: RuntimeDependency = {
        command: 'fakecli',
        displayName: 'FakeCLI'
      };
      
      const result = await checker.checkDependency(dependency);
      
      expect(result.isAvailable).toBe(false);
      expect(result.error).toContain('FakeCLI is not installed on the server');
    });
  });
  
  describe('Plugin Dependencies', () => {
    it('should check all plugin dependencies', async () => {
      checker = new DependencyChecker(mockSSH, mockProxy, false);
      mockProxy.executeCommand.mockResolvedValue({ output: '/usr/bin/tool' });
      
      const plugin: VsshPlugin = {
        name: 'test',
        version: '1.0.0',
        description: 'Test',
        runtimeDependencies: [
          { command: 'tool1', displayName: 'Tool 1' },
          { command: 'tool2', displayName: 'Tool 2' }
        ],
        commands: []
      };
      
      const results = await checker.checkPluginDependencies(plugin);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.isAvailable)).toBe(true);
    });
    
    it('should throw on missing required dependencies', () => {
      checker = new DependencyChecker(mockSSH, mockProxy, false);
      
      const results = [
        {
          dependency: { command: 'docker', displayName: 'Docker', optional: false },
          isAvailable: false,
          error: 'Docker is not installed'
        },
        {
          dependency: { command: 'git', displayName: 'Git', optional: true },
          isAvailable: false,
          error: 'Git is not installed'
        }
      ];
      
      expect(() => checker.assertAllDependenciesAvailable(results))
        .toThrow('Missing required dependencies');
    });
  });
  
  describe('Caching', () => {
    it('should cache dependency check results', async () => {
      checker = new DependencyChecker(mockSSH, mockProxy, true);
      mockSSH.executeCommand.mockResolvedValue('/usr/bin/docker');
      
      const dependency: RuntimeDependency = {
        command: 'docker',
        displayName: 'Docker'
      };
      
      // First call
      await checker.checkDependency(dependency);
      expect(mockSSH.executeCommand).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await checker.checkDependency(dependency);
      expect(mockSSH.executeCommand).toHaveBeenCalledTimes(1);
      
      // Clear cache and call again
      checker.clearCache();
      await checker.checkDependency(dependency);
      expect(mockSSH.executeCommand).toHaveBeenCalledTimes(2);
    });
  });
});
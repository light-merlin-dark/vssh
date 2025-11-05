import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ProxyService, CommandResult, JSONResponse } from '../../../src/services/proxy-service';
import { SSHService } from '../../../src/services/ssh';
import { CommandGuardService } from '../../../src/services/command-guard-service';
import type { Config } from '../../../src/config';

// Mock dependencies
mock.module('../../../src/services/ssh', () => ({
  SSHService: mock(() => ({
    executeCommand: mock(() => Promise.resolve('mock output')),
  })),
}));

mock.module('../../../src/services/command-guard-service', () => ({
  CommandGuardService: mock(() => ({
    checkCommand: mock(() => ({ isBlocked: false, reasons: [] })),
    displayBlockedMessage: mock(() => {}),
    logBlockedCommand: mock(() => {}),
  })),
}));

// Mock child_process at module level for dynamic imports
let mockExecSync: any;
mock.module('child_process', () => ({
  execSync: mock(() => mockExecSync?.() || 'mock local output'),
}));

describe('ProxyService Output Modes', () => {
  let proxyService: ProxyService;
  let mockConfig: Config;
  let mockSSHService: SSHService;
  let mockCommandGuard: CommandGuardService;

  beforeEach(async () => {
    // Reset execSync mock before each test
    mockExecSync = () => 'mock local output';
    
    mockConfig = {
      host: 'test.example.com',
      user: 'testuser',
      keyPath: '/test/key',
      localMode: false,
    };

    mockSSHService = new SSHService(mockConfig);
    mockCommandGuard = new CommandGuardService();
    proxyService = new ProxyService(mockConfig, mockSSHService, mockCommandGuard);
    
    // Mock console methods to capture output
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    
    // Mock fs for logging
    spyOn(require('fs'), 'appendFileSync').mockImplementation(() => {});
    spyOn(require('fs'), 'existsSync').mockReturnValue(true);
    spyOn(require('fs'), 'mkdirSync').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  describe('JSON Mode', () => {
    it('should return structured CommandResult object', async () => {
      const result = await proxyService.executeCommand('echo test', { outputMode: 'json' });
      
      expect(result).toEqual({
        output: 'mock output',
        duration: expect.any(Number),
        timestamp: expect.any(String),
        command: 'echo test',
        isLocal: false,
        exitCode: 0,
      });
    });

    it('should route metadata to stderr in JSON mode', async () => {
      await proxyService.executeCommand('echo test', { outputMode: 'json' });
      
      expect(console.error).toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
      expect(console.log).not.toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
    });

    it('should format JSON response correctly', async () => {
      const mockResult: CommandResult = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      const jsonResponse = proxyService.formatJSONResponse(mockResult);
      const parsed = JSON.parse(jsonResponse) as JSONResponse;

      expect(parsed).toEqual({
        success: true,
        command: 'test command',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        output: 'test output',
        error: undefined,
        metadata: {
          isLocal: false,
          exitCode: 0,
        },
      });
    });

    it('should handle errors in JSON format', async () => {
      const mockError = new Error('Test error');
      const mockResult: CommandResult = {
        output: '',
        duration: 0,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'failing command',
      };

      const jsonResponse = proxyService.formatJSONResponse(mockResult, mockError);
      const parsed = JSON.parse(jsonResponse) as JSONResponse;

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe('Test error');
      expect(parsed.metadata?.exitCode).toBe(1);
    });

    it('should filter JSON fields when specified', async () => {
      const mockResult: CommandResult = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      proxyService.setJSONFields(['output', 'duration']);
      const jsonResponse = proxyService.formatJSONResponse(mockResult);
      const parsed = JSON.parse(jsonResponse);

      expect(parsed).toEqual({
        output: 'test output',
        duration: 123,
      });
    });
  });

  describe('Quiet Mode', () => {
    it('should return clean CommandResult object', async () => {
      const result = await proxyService.executeCommand('echo test', { outputMode: 'quiet' });
      
      expect(result).toEqual({
        output: 'mock output',
        duration: expect.any(Number),
        timestamp: expect.any(String),
        command: 'echo test',
        isLocal: false,
        exitCode: 0,
      });
    });

    it('should route metadata to stderr in quiet mode', async () => {
      await proxyService.executeCommand('echo test', { outputMode: 'quiet' });
      
      expect(console.error).toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
      expect(console.log).not.toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.log).not.toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
    });
  });

  describe('Raw Mode', () => {
    it('should return CommandResult object in raw mode', async () => {
      const result = await proxyService.executeCommand('echo test', { outputMode: 'raw' });
      
      expect(result).toEqual({
        output: 'mock output',
        duration: expect.any(Number),
        timestamp: expect.any(String),
        command: 'echo test',
        isLocal: false,
        exitCode: 0,
      });
    });

    it('should include emoji prefixes in stdout in raw mode', async () => {
      await proxyService.executeCommand('echo test', { outputMode: 'raw' });
      
      expect(console.log).toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
      expect(console.error).not.toHaveBeenCalledWith('🚀 Executing: echo test');
      expect(console.error).not.toHaveBeenCalledWith(expect.stringMatching(/✅ Completed in \d+ms/));
    });
  });

  describe('Local Mode', () => {
    beforeEach(() => {
      proxyService.setLocalMode(true);
    });

    it('should handle local execution in JSON mode', async () => {
      // Mock child_process for local execution
      spyOn(require('child_process'), 'execSync').mockReturnValue('local output');
      
      const result = await proxyService.executeCommand('echo local', { outputMode: 'json' });
      
      expect(result.isLocal).toBe(true);
      expect(console.error).toHaveBeenCalledWith('🚀 Executing locally: echo local');
    });

    it('should handle local execution in quiet mode', async () => {
      spyOn(require('child_process'), 'execSync').mockReturnValue('local output');
      
      await proxyService.executeCommand('echo local', { outputMode: 'quiet' });
      
      expect(console.error).toHaveBeenCalledWith('🚀 Executing locally: echo local');
    });

    it('should handle local execution in raw mode', async () => {
      spyOn(require('child_process'), 'execSync').mockReturnValue('local output');
      
      await proxyService.executeCommand('echo local', { outputMode: 'raw' });
      
      expect(console.log).toHaveBeenCalledWith('🚀 Executing locally: echo local');
    });
  });

  describe('Error Handling', () => {
    it('should handle SSH execution errors in all modes', async () => {
      const mockError = new Error('SSH connection failed');
      spyOn(mockSSHService, 'executeCommand').mockRejectedValue(mockError);

      await expect(proxyService.executeCommand('failing command', { outputMode: 'json' }))
        .rejects.toThrow('SSH connection failed');
    });

    it('should handle local execution errors in all modes', async () => {
      proxyService.setLocalMode(true);
      const mockError = new Error('Command not found');
      
      // Set up the mock to throw an error
      mockExecSync = () => {
        throw mockError;
      };

      await expect(proxyService.executeCommand('nonexistent command', { outputMode: 'json' }))
        .rejects.toThrow('Command not found');
    });
  });

  describe('Command Guard Integration', () => {
    it('should respect skipGuard option', async () => {
      const options = { outputMode: 'json', skipGuard: true };
      
      await proxyService.executeCommand('test command', options);
      
      // Should not call checkCommand when skipGuard is true
      expect(mockCommandGuard.checkCommand).not.toHaveBeenCalled();
    });

    it('should block dangerous commands', async () => {
      spyOn(mockCommandGuard, 'checkCommand').mockReturnValue({
        isBlocked: true,
        reasons: ['Dangerous command detected'],
      });

      await expect(proxyService.executeCommand('rm -rf /', { outputMode: 'json' }))
        .rejects.toThrow('Command blocked: Dangerous command detected');
    });

    it('should display warnings for suspicious commands', async () => {
      spyOn(mockCommandGuard, 'checkCommand').mockReturnValue({
        isBlocked: false,
        reasons: ['⚠️ Suspicious command pattern'],
      });

      await proxyService.executeCommand('suspicious command', { outputMode: 'json' });
      
      expect(console.warn).toHaveBeenCalledWith('⚠️ Suspicious command pattern');
    });
  });

  describe('Performance', () => {
    it('should complete execution within reasonable time', async () => {
      const startTime = Date.now();
      
      await proxyService.executeCommand('echo test', { outputMode: 'json' });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms
    });

    it('should handle large output efficiently', async () => {
      const largeOutput = 'x'.repeat(10000); // 10KB of output
      spyOn(mockSSHService, 'executeCommand').mockResolvedValue(largeOutput);

      const startTime = Date.now();
      const result = await proxyService.executeCommand('large output command', { outputMode: 'json' });
      const duration = Date.now() - startTime;

      expect(result.output).toBe(largeOutput);
      expect(duration).toBeLessThan(50); // Should handle large output quickly
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ProxyService } from '../../src/services/proxy-service';
import { SSHService } from '../../src/services/ssh';
import { CommandGuardService } from '../../src/services/command-guard-service';
import type { Config } from '../../src/config';

describe('JSON Serialization Performance', () => {
  let proxyService: ProxyService;
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      host: 'test.example.com',
      user: 'testuser',
      keyPath: '/test/key',
      localMode: false,
    };

    const mockSSHService = new SSHService(mockConfig);
    const mockCommandGuard = new CommandGuardService();
    proxyService = new ProxyService(mockConfig, mockSSHService, mockCommandGuard);
  });

  describe('Serialization Speed', () => {
    it('should serialize small outputs efficiently', () => {
      const smallResult = {
        output: 'Hello World',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'echo hello',
        isLocal: false,
        exitCode: 0,
      };

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(smallResult);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per serialization
      expect(duration).toBeLessThan(100); // Less than 100ms total
    });

    it('should serialize medium outputs efficiently', () => {
      const mediumOutput = 'x'.repeat(1000); // 1KB
      const mediumResult = {
        output: mediumOutput,
        duration: 456,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'generate medium output',
        isLocal: false,
        exitCode: 0,
      };

      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(mediumResult);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(2); // Less than 2ms per serialization
      expect(duration).toBeLessThan(200); // Less than 200ms total
    });

    it('should serialize large outputs efficiently', () => {
      const largeOutput = 'x'.repeat(100000); // 100KB
      const largeResult = {
        output: largeOutput,
        duration: 789,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'generate large output',
        isLocal: false,
        exitCode: 0,
      };

      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(largeResult);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(10); // Less than 10ms per serialization
      expect(duration).toBeLessThan(100); // Less than 100ms total
    });
  });

  describe('Field Filtering Performance', () => {
    it('should filter fields quickly', () => {
      const result = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      proxyService.setJSONFields(['output', 'duration']);

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(result);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per filtered serialization
    });

    it('should handle many field filters efficiently', () => {
      const result = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
        extraField1: 'extra1',
        extraField2: 'extra2',
        extraField3: 'extra3',
      };

      proxyService.setJSONFields(['output', 'duration', 'extraField1', 'extraField2', 'extraField3']);

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(result);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(2); // Less than 2ms per filtered serialization
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during repeated serialization', () => {
      const result = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many serializations
      for (let i = 0; i < 10000; i++) {
        proxyService.formatJSONResponse(result);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 1MB)
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });

    it('should handle large outputs without excessive memory usage', () => {
      const largeOutput = 'x'.repeat(100000); // 100KB
      const largeResult = {
        output: largeOutput,
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'large command',
        isLocal: false,
        exitCode: 0,
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Serialize large output
      const jsonOutput = proxyService.formatJSONResponse(largeResult);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // JSON output should exist
      expect(jsonOutput).toContain(largeOutput);
      
      // Memory increase should be reasonable (less than 10MB for 100KB output)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling Performance', () => {
    it('should handle error serialization efficiently', () => {
      const error = new Error('Test error message');
      const result = {
        output: '',
        duration: 0,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'failing command',
      };

      const iterations = 1000;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(result, error);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per error serialization
    });
  });

  describe('Complex JSON Structures', () => {
    it('should handle complex nested objects efficiently', () => {
      const complexResult = {
        output: JSON.stringify({
          users: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `User ${i}`,
            email: `user${i}@example.com`,
            roles: ['user', 'reader'],
            metadata: {
              created: '2025-01-01',
              lastLogin: new Date().toISOString(),
              preferences: {
                theme: 'dark',
                notifications: true,
                language: 'en'
              }
            }
          }))
        }),
        duration: 1234,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'get users',
        isLocal: false,
        exitCode: 0,
      };

      const iterations = 10;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        proxyService.formatJSONResponse(complexResult);
      }

      const duration = Date.now() - startTime;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(50); // Less than 50ms per complex serialization
    });
  });

  describe('Concurrent Serialization', () => {
    it('should handle concurrent serialization efficiently', async () => {
      const result = {
        output: 'concurrent test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'concurrent test',
        isLocal: false,
        exitCode: 0,
      };

      const concurrentTasks = 100;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentTasks }, () =>
        Promise.resolve(proxyService.formatJSONResponse(result))
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      const avgTime = duration / concurrentTasks;

      expect(avgTime).toBeLessThan(5); // Less than 5ms per concurrent serialization
      expect(duration).toBeLessThan(500); // Less than 500ms total
    });
  });

  describe('Output Size Optimization', () => {
    it('should produce reasonably sized JSON output', () => {
      const result = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      const jsonOutput = proxyService.formatJSONResponse(result);
      const outputSize = Buffer.byteLength(jsonOutput, 'utf8');

      // JSON output should be reasonably sized (less than 500 bytes for small result)
      expect(outputSize).toBeLessThan(500);
    });

    it('should reduce output size with field filtering', () => {
      const result = {
        output: 'test output',
        duration: 123,
        timestamp: '2025-01-01T00:00:00.000Z',
        command: 'test command',
        isLocal: false,
        exitCode: 0,
      };

      // Full JSON
      const fullJson = proxyService.formatJSONResponse(result);
      const fullSize = Buffer.byteLength(fullJson, 'utf8');

      // Filtered JSON
      proxyService.setJSONFields(['output']);
      const filteredJson = proxyService.formatJSONResponse(result);
      const filteredSize = Buffer.byteLength(filteredJson, 'utf8');

      // Filtered should be significantly smaller
      expect(filteredSize).toBeLessThan(fullSize * 0.7); // Adjusted expectation
      // The actual output includes pretty-printing
      expect(filteredJson).toContain('"output": "test output"');
    });
  });
});

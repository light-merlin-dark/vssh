import { describe, it, expect, beforeEach } from 'vitest';
import { createMockContext, captureOutput } from '@vssh/test-utils';
import { listContainersCommand } from '../../commands/list-containers';

describe('list-docker-containers command', () => {
  let context: any;
  let mockSSH: any;
  
  beforeEach(() => {
    ({ context, mockSSH } = createMockContext());
  });
  
  it('should display containers in formatted table', async () => {
    // Set up mock response
    mockSSH.setResponse(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      'abc123456789|web-app|Up 2 hours|nginx:latest|0.0.0.0:80->80/tcp|2024-01-01 12:00:00 +0000 UTC\n' +
      'def123456789|api-server|Up 1 hour|node:18|0.0.0.0:3000->3000/tcp|2024-01-01 13:00:00 +0000 UTC\n' +
      'ghi123456789|database|Exited (0) 3 hours ago|postgres:15||2024-01-01 10:00:00 +0000 UTC'
    );
    
    const { stdout } = await captureOutput(async () => {
      await listContainersCommand(context, { _: [] });
    });
    
    // Check headers
    expect(stdout).toContain('CONTAINER ID');
    expect(stdout).toContain('NAME');
    expect(stdout).toContain('STATUS');
    
    // Check data
    expect(stdout).toContain('abc123456789');
    expect(stdout).toContain('web-app');
    expect(stdout).toContain('Up 2 hours');
    expect(stdout).toContain('api-server');
    expect(stdout).toContain('database');
    expect(stdout).toContain('Exited (0) 3 hours ago');
    
    // Verify correct command was called
    expect(mockSSH.getLastCommand()).toBe(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"'
    );
  });
  
  it('should handle empty container list', async () => {
    mockSSH.setResponse(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      ''
    );
    
    const { stdout } = await captureOutput(async () => {
      await listContainersCommand(context, { _: [] });
    });
    
    expect(stdout).toContain('No containers found');
  });
  
  it('should handle SSH errors gracefully', async () => {
    mockSSH.throwOnCommand(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      'Connection refused'
    );
    
    let processExitCode: number | undefined;
    const originalExit = process.exit;
    process.exit = ((code?: number) => {
      processExitCode = code;
    }) as any;
    
    try {
      await listContainersCommand(context, { _: [] });
    } finally {
      process.exit = originalExit;
    }
    
    expect(processExitCode).toBe(1);
    const errorLogs = context.logger.getLogs().error;
    expect(errorLogs.length).toBeGreaterThan(0);
    expect(errorLogs[0][0]).toContain('Failed to list containers');
  });
  
  it('should handle containers with long names', async () => {
    mockSSH.setResponse(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      'abc123456789|very-long-container-name-that-should-still-display|Up 2 hours|nginx:latest|0.0.0.0:80->80/tcp|2024-01-01 12:00:00 +0000 UTC'
    );
    
    const { stdout } = await captureOutput(async () => {
      await listContainersCommand(context, { _: [] });
    });
    
    expect(stdout).toContain('very-long-container-name-that-should-still-display');
  });
  
  it('should truncate container IDs to 12 characters', async () => {
    mockSSH.setResponse(
      'docker ps -a --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"',
      'abcdefghijklmnopqrstuvwxyz|test-container|Up 1 hour|alpine:latest||2024-01-01 12:00:00 +0000 UTC'
    );
    
    const { stdout } = await captureOutput(async () => {
      await listContainersCommand(context, { _: [] });
    });
    
    // Should show only first 12 characters
    expect(stdout).toContain('abcdefghijkl');
    expect(stdout).not.toContain('abcdefghijklmnop');
  });
});
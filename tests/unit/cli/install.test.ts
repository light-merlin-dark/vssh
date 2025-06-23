import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInstallCommand } from '../../../src/cli/install';
import { exec } from 'child_process';

// Mock child_process exec
vi.mock('child_process', () => ({
  exec: vi.fn()
}));

const mockExec = vi.mocked(exec);

describe('Install Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  it('should install vssh successfully when dependencies are met', async () => {
    // Mock successful which command (vssh-mcp exists)
    mockExec
      .mockImplementationOnce((cmd, callback) => {
        if (cmd === 'which vssh-mcp') {
          callback?.(null, '/usr/local/bin/vssh-mcp\n', '');
        }
      })
      // Mock successful remove command
      .mockImplementationOnce((cmd, callback) => {
        if (cmd === 'claude mcp remove vssh 2>/dev/null || true') {
          callback?.(null, '', '');
        }
      })
      // Mock successful add command
      .mockImplementationOnce((cmd, callback) => {
        if (cmd.includes('claude mcp add-json vssh')) {
          callback?.(null, 'Added MCP server successfully\n', '');
        }
      });

    await handleInstallCommand();

    expect(console.log).toHaveBeenCalledWith('Installing vssh as MCP server in Claude Code...\n');
    expect(console.log).toHaveBeenCalledWith('✅ vssh successfully installed as MCP server!\n');
  });

  it('should fail when vssh-mcp command is not found', async () => {
    // Mock failing which command (vssh-mcp not found)
    mockExec.mockImplementationOnce((cmd, callback) => {
      if (cmd === 'which vssh-mcp') {
        callback?.(new Error('command not found'), '', 'vssh-mcp: not found');
      }
    });

    await expect(async () => {
      await handleInstallCommand();
    }).rejects.toThrow('process.exit called');

    expect(console.error).toHaveBeenCalledWith('❌ vssh-mcp command not found.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it('should provide helpful error message when claude CLI is not found', async () => {
    // Mock successful which command (vssh-mcp exists)
    mockExec
      .mockImplementationOnce((cmd, callback) => {
        if (cmd === 'which vssh-mcp') {
          callback?.(null, '/usr/local/bin/vssh-mcp\n', '');
        }
      })
      // Mock successful remove command
      .mockImplementationOnce((cmd, callback) => {
        if (cmd === 'claude mcp remove vssh 2>/dev/null || true') {
          callback?.(null, '', '');
        }
      })
      // Mock failing claude command (not found)
      .mockImplementationOnce((cmd, callback) => {
        if (cmd.includes('claude mcp add-json vssh')) {
          callback?.(new Error('claude: command not found'), '', 'claude: command not found');
        }
      });

    await expect(async () => {
      await handleInstallCommand();
    }).rejects.toThrow('process.exit called');

    expect(console.error).toHaveBeenCalledWith('❌ Failed to install vssh as MCP server');
    expect(console.error).toHaveBeenCalledWith('Claude Code CLI is not installed or not in PATH.');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
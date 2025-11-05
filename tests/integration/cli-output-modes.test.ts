import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { spawn } from 'child_process';
import { promisify } from 'util';

// Helper function to capture CLI output
async function captureCLIOutput(args: string[]): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  return new Promise((resolve) => {
    const child = spawn('node', ['dist/src/index.js', ...args], {
      cwd: process.cwd(),
      stdio: 'pipe',
      env: {
        ...process.env,
        // Suppress plugin loading errors for cleaner test output
        VSSH_TEST_MODE: 'true',
        NODE_ENV: 'test'
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      // Filter out plugin loading warnings for cleaner tests
      const cleanStderr = stderr
        .split('\n')
        .filter(line => !line.includes('Failed to load plugin'))
        .join('\n')
        .trim();
      
      resolve({
        stdout: stdout.trim(),
        stderr: cleanStderr,
        exitCode: code || 0,
      });
    });
  });
}

// Helper to parse JSON safely
function parseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

describe('CLI Output Mode Integration', () => {
  beforeEach(async () => {
    // Ensure the project is built before tests
    await promisify(require('child_process').exec)('npm run build');
  });

  describe('Default Behavior', () => {
    it('should default to JSON output when no flags specified', async () => {
      const result = await captureCLIOutput(['--local', 'echo "test output"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('🚀 Executing locally: echo "test output"');
      expect(result.stderr).toContain('✅ Completed in');
      
      const parsed = parseJSON(result.stdout);
      expect(parsed).not.toBeNull();
      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('echo "test output"');
      expect(parsed.output).toBe('test output\n');
      expect(parsed.metadata.isLocal).toBe(true);
    });
  });

  describe('JSON Mode', () => {
    it('should parse --json flag correctly', async () => {
      const result = await captureCLIOutput(['--local', '--json', 'echo "json test"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('🚀 Executing locally: echo "json test"');
      
      const parsed = parseJSON(result.stdout);
      expect(parsed).not.toBeNull();
      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('echo "json test"');
      expect(parsed.output).toBe('json test\n');
    });

    it('should parse --fields flag correctly', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        '--fields', 
        'output,duration', 
        'echo "field test"'
      ]);
      
      expect(result.exitCode).toBe(0);
      
      const parsed = parseJSON(result.stdout);
      expect(parsed).not.toBeNull();
      expect(parsed).toEqual({
        output: 'field test\n',
        duration: expect.any(Number),
      });
      expect(parsed.success).toBeUndefined();
      expect(parsed.command).toBeUndefined();
    });

    it('should handle multiple --fields values', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        '--fields', 
        'output,command,timestamp', 
        'echo "multi field"'
      ]);
      
      const parsed = parseJSON(result.stdout);
      expect(parsed).toEqual({
        output: 'multi field\n',
        command: 'echo "multi field"',
        timestamp: expect.any(String),
      });
    });

    it('should handle errors in JSON mode', async () => {
      const result = await captureCLIOutput(['--local', '--json', 'nonexistent-command']);
      
      expect(result.exitCode).toBe(1);
      
      const parsed = parseJSON(result.stdout);
      expect(parsed).not.toBeNull();
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('nonexistent-command');
      expect(parsed.metadata.exitCode).toBe(1);
    });
  });

  describe('Quiet Mode', () => {
    it('should parse --quiet flag correctly', async () => {
      const result = await captureCLIOutput(['--local', '--quiet', 'echo "quiet test"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toContain('🚀 Executing locally: echo "quiet test"');
      expect(result.stderr).toContain('✅ Completed in');
      expect(result.stdout).toBe('quiet test');
    });

    it('should route metadata to stderr in quiet mode', async () => {
      const result = await captureCLIOutput(['--local', '--quiet', 'echo "stderr test"']);
      
      expect(result.stdout).toBe('stderr test');
      expect(result.stderr).toContain('🚀 Executing locally: echo "stderr test"');
      expect(result.stderr).toContain('✅ Completed in');
    });

    it('should handle errors in quiet mode', async () => {
      const result = await captureCLIOutput(['--local', '--quiet', 'nonexistent-command']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('❌');
      expect(result.stdout).toBe('');
    });
  });

  describe('Raw Mode', () => {
    it('should parse --raw flag correctly', async () => {
      const result = await captureCLIOutput(['--local', '--raw', 'echo "raw test"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🚀 Executing locally: echo "raw test"');
      expect(result.stdout).toContain('✅ Completed in');
      expect(result.stdout).toContain('raw test');
      expect(result.stderr).toBe('');
    });

    it('should include emoji prefixes in stdout in raw mode', async () => {
      const result = await captureCLIOutput(['--local', '--raw', 'echo "emoji test"']);
      
      expect(result.stdout).toContain('🚀 Executing locally: echo "emoji test"');
      expect(result.stdout).toContain('✅ Completed in');
      expect(result.stdout).toContain('emoji test');
      expect(result.stderr).toBe('');
    });

    it('should handle errors in raw mode', async () => {
      const result = await captureCLIOutput(['--local', '--raw', 'nonexistent-command']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('🚀 Executing locally: nonexistent-command');
      expect(result.stderr).toContain('❌');
    });
  });

  describe('Flag Combinations', () => {
    it('should handle --json with --local flag', async () => {
      const result = await captureCLIOutput(['--json', '--local', 'echo "combo test"']);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.metadata.isLocal).toBe(true);
    });

    it('should handle --quiet with --local flag', async () => {
      const result = await captureCLIOutput(['--quiet', '--local', 'echo "combo quiet"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('combo quiet');
      expect(result.stderr).toContain('locally');
    });

    it('should handle --raw with --local flag', async () => {
      const result = await captureCLIOutput(['--raw', '--local', 'echo "combo raw"']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('locally');
      expect(result.stdout).toContain('combo raw');
    });

    it('should prioritize last flag when multiple output modes specified', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        '--quiet', 
        '--raw', 
        'echo "priority test"'
      ]);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('🚀'); // Raw mode should win
      expect(result.stdout).toContain('priority test');
    });
  });

  describe('Help and Documentation', () => {
    it('should show help for --help-output flag', async () => {
      const result = await captureCLIOutput(['--help-output']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('VSSH Output Mode Options');
      expect(result.stdout).toContain('--json');
      expect(result.stdout).toContain('--quiet');
      expect(result.stdout).toContain('--raw');
      expect(result.stdout).toContain('Default: Output structured JSON');
    });

    it('should show main help without errors', async () => {
      const result = await captureCLIOutput(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('VSSH - AI-Friendly SSH Command Proxy');
    });
  });

  describe('Complex Commands', () => {
    it('should handle commands with quotes in JSON mode', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        'echo "complex \\"quoted\\" string"'
      ]);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.command).toBe('echo "complex \\"quoted\\" string"');
      expect(parsed.output).toBe('complex "quoted" string\n');
    });

    it('should handle commands with pipes in JSON mode', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        'echo "hello world" | tr a-z A-Z'
      ]);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toContain('HELLO WORLD');
    });

    it('should handle commands with special characters', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        'echo "line1\\nline2\\tindented"'
      ]);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toContain('line1');
      expect(parsed.output).toContain('line2');
      expect(parsed.output).toContain('indented');
    });
  });

  describe('Performance Tests', () => {
    it('should complete JSON mode execution within reasonable time', async () => {
      const startTime = Date.now();
      const result = await captureCLIOutput(['--local', '--json', 'echo "performance test"']);
      const duration = Date.now() - startTime;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle larger outputs efficiently', async () => {
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        'seq 1 1000' // Generate numbers 1 to 1000
      ]);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      // Adjust expectation - seq command output is smaller than estimated
      expect(parsed.output.length).toBeGreaterThan(3000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty command in JSON mode', async () => {
      const result = await captureCLIOutput(['--local', '--json', 'echo']);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toBe('\n');
    });

    it('should handle command that outputs only whitespace', async () => {
      const result = await captureCLIOutput(['--local', '--json', 'echo "   "']);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toBe('   \n');
    });

    it('should handle very long command arguments', async () => {
      const longArg = 'a'.repeat(1000);
      const result = await captureCLIOutput([
        '--local', 
        '--json', 
        `echo "${longArg}"`
      ]);
      
      expect(result.exitCode).toBe(0);
      const parsed = parseJSON(result.stdout);
      expect(parsed.success).toBe(true);
      expect(parsed.output).toBe(`${longArg}\n`);
    });
  });
});

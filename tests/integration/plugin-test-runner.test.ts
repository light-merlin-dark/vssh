import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface PluginInfo {
  name: string;
  path: string;
  hasTests: boolean;
  packageJson?: any;
}

/**
 * Plugin Test Runner
 * 
 * This integration test discovers all plugins and runs their individual test suites.
 * Each plugin's tests are run in isolation to ensure true plugin independence.
 */
describe('Plugin Test Runner', () => {
  let plugins: PluginInfo[] = [];
  
  beforeAll(async () => {
    plugins = await discoverPlugins();
  });
  
  it('should discover plugins with tests', () => {
    const pluginsWithTests = plugins.filter(p => p.hasTests);
    expect(pluginsWithTests.length).toBeGreaterThan(0);
  });
  
  // Run tests for each plugin
  plugins.forEach(plugin => {
    if (plugin.hasTests) {
      describe(`Plugin: ${plugin.name}`, () => {
        it(`should pass all tests`, async () => {
          const result = await runPluginTests(plugin);
          
          expect(result.exitCode).toBe(0);
          expect(result.stderr).not.toContain('FAIL');
          
          // Extract summary for assertion (but don't log it)
          if (result.stdout) {
            const summary = extractTestSummary(result.stdout);
            // Verify that tests actually ran
            expect(summary).not.toBe('No test summary found');
          }
        }, 30000); // 30 second timeout per plugin
      });
    }
  });
});

/**
 * Discovers all plugins in the builtin directory
 */
async function discoverPlugins(): Promise<PluginInfo[]> {
  const builtinDir = path.join(__dirname, '../../src/plugins/builtin');
  const plugins: PluginInfo[] = [];
  
  try {
    const entries = await fs.readdir(builtinDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pluginPath = path.join(builtinDir, entry.name);
        const plugin = await analyzePlugin(entry.name, pluginPath);
        plugins.push(plugin);
      }
    }
  } catch (error) {
    // Silently ignore discovery errors in tests
  }
  
  return plugins;
}

/**
 * Analyzes a plugin directory to determine if it has tests
 */
async function analyzePlugin(name: string, pluginPath: string): Promise<PluginInfo> {
  const info: PluginInfo = {
    name,
    path: pluginPath,
    hasTests: false
  };
  
  // Check for tests directory
  const testsPath = path.join(pluginPath, 'tests');
  try {
    const testsStat = await fs.stat(testsPath);
    if (testsStat.isDirectory()) {
      // Check if there are test files
      const testFiles = await fs.readdir(testsPath);
      info.hasTests = testFiles.some(file => 
        file.endsWith('.test.ts') || file.endsWith('.spec.ts')
      );
    }
  } catch {
    // No tests directory
  }
  
  // Check for package.json
  try {
    const packageJsonPath = path.join(pluginPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    info.packageJson = packageJson;
  } catch {
    // No package.json
  }
  
  return info;
}

/**
 * Runs tests for a specific plugin
 */
async function runPluginTests(plugin: PluginInfo): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    const testCommand = plugin.packageJson?.scripts?.test || 'vitest run tests/';
    const [cmd, ...args] = testCommand.split(' ');
    
    const child = spawn(cmd, args, {
      cwd: plugin.path,
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        CI: 'true' // Run in CI mode for consistent output
      }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        exitCode: code || 0,
        stdout,
        stderr
      });
    });
    
    // Handle errors
    child.on('error', (error) => {
      stderr += `\nProcess error: ${error.message}`;
      resolve({
        exitCode: 1,
        stdout,
        stderr
      });
    });
  });
}

/**
 * Extracts test summary from vitest output
 */
function extractTestSummary(output: string): string {
  // Look for vitest summary line like "✓ 10 tests passed"
  const summaryMatch = output.match(/✓\s+(\d+)\s+test[s]?\s+passed/);
  if (summaryMatch) {
    return summaryMatch[0];
  }
  
  // Look for failure summary
  const failMatch = output.match(/✗\s+(\d+)\s+test[s]?\s+failed/);
  if (failMatch) {
    return failMatch[0];
  }
  
  return 'No test summary found';
}
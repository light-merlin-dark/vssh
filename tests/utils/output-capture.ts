import { spawn } from 'child_process';
import { promisify } from 'util';

export interface CapturedOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class OutputCapture {
  /**
   * Capture stdout, stderr, and exit code from a CLI command
   */
  static async captureCommand(args: string[]): Promise<CapturedOutput> {
    return new Promise((resolve) => {
      const child = spawn('node', ['dist/src/index.js', ...args], {
        cwd: process.cwd(),
        stdio: 'pipe',
        env: {
          ...process.env,
          // Suppress plugin loading errors for cleaner test output
          VSSH_TEST_MODE: 'true'
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
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      // Handle spawn errors
      child.on('error', (error) => {
        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Parse JSON output safely with error handling
   */
  static parseJSON(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${(error as Error).message}\nInput: ${jsonString}`);
    }
  }

  /**
   * Extract JSON from mixed output (handles cases where JSON is mixed with other text)
   */
  static extractJSON(output: string): any {
    // Try to parse the entire output first
    try {
      return JSON.parse(output);
    } catch {
      // Look for JSON object in the output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (error) {
          throw new Error(`Found JSON-like structure but failed to parse: ${(error as Error).message}`);
        }
      }
      throw new Error('No JSON found in output');
    }
  }

  /**
   * Validate JSON response structure against expected schema
   */
  static validateJSONResponse(response: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (typeof response !== 'object' || response === null) {
      errors.push('Response must be an object');
      return { isValid: false, errors };
    }

    // Required fields for successful responses
    if (response.success !== false) {
      const requiredFields = ['success', 'command', 'duration', 'timestamp'];
      for (const field of requiredFields) {
        if (!(field in response)) {
          errors.push(`Missing required field: ${field}`);
        }
      }
    }

    // Type validation
    if ('success' in response && typeof response.success !== 'boolean') {
      errors.push('success field must be boolean');
    }

    if ('command' in response && typeof response.command !== 'string') {
      errors.push('command field must be string');
    }

    if ('duration' in response && typeof response.duration !== 'number') {
      errors.push('duration field must be number');
    }

    if ('timestamp' in response && typeof response.timestamp !== 'string') {
      errors.push('timestamp field must be string');
    }

    if ('output' in response && typeof response.output !== 'string') {
      errors.push('output field must be string');
    }

    if ('error' in response && typeof response.error !== 'string') {
      errors.push('error field must be string');
    }

    if (response.metadata && typeof response.metadata !== 'object') {
      errors.push('metadata field must be object');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Measure execution time of a command
   */
  static async measureExecution(args: string[]): Promise<{
    output: CapturedOutput;
    duration: number;
  }> {
    const startTime = Date.now();
    const output = await this.captureCommand(args);
    const duration = Date.now() - startTime;

    return { output, duration };
  }

  /**
   * Capture output with timeout
   */
  static async captureCommandWithTimeout(
    args: string[], 
    timeoutMs: number = 5000
  ): Promise<CapturedOutput> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', ['dist/src/index.js', ...args], {
        cwd: process.cwd(),
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on('close', (code) => {
        clearTimeout(timeout);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          stdout: '',
          stderr: error.message,
          exitCode: 1,
        });
      });
    });
  }

  /**
   * Compare two outputs for equality (ignoring dynamic values like timestamps)
   */
  static compareOutputs(output1: string, output2: string, options: {
    ignoreTimestamps?: boolean;
    ignoreDuration?: boolean;
    ignoreWhitespace?: boolean;
  } = {}): boolean {
    let str1 = output1;
    let str2 = output2;

    if (options.ignoreWhitespace) {
      str1 = str1.replace(/\s+/g, ' ').trim();
      str2 = str2.replace(/\s+/g, ' ').trim();
    }

    if (options.ignoreTimestamps) {
      str1 = str1.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]');
      str2 = str2.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '[TIMESTAMP]');
    }

    if (options.ignoreDuration) {
      str1 = str1.replace(/"duration":\s*\d+/g, '"duration":[DURATION]');
      str2 = str2.replace(/"duration":\s*\d+/g, '"duration":[DURATION]');
    }

    return str1 === str2;
  }
}

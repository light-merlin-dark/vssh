import { vi } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';

// Set NODE_ENV to test to suppress logging
process.env.NODE_ENV = 'test';

// Mock the config path to use a test directory
vi.mock('../src/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/config')>();
  return {
    ...actual,
    CONFIG_PATH: join(__dirname, 'fixtures', 'test-config.json'),
    DATA_DIR: join(__dirname, 'fixtures', 'data')
  };
});

// Global test utilities
global.testHelpers = {
  // Create a delay for async testing
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Capture console output
  captureOutput: async (fn: () => void | Promise<void>) => {
    const originalLog = console.log;
    const originalError = console.error;
    let output = '';
    let errorOutput = '';
    
    console.log = (...args: any[]) => { output += args.join(' ') + '\n'; };
    console.error = (...args: any[]) => { errorOutput += args.join(' ') + '\n'; };
    
    try {
      await fn();
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    
    return { output, errorOutput };
  }
};

// Extend global type definitions
declare global {
  var testHelpers: {
    delay: (ms: number) => Promise<void>;
    captureOutput: (fn: () => void | Promise<void>) => Promise<{ output: string; errorOutput: string }>;
  };
}
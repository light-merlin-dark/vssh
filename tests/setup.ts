import { join } from 'path';

// Set NODE_ENV to test to suppress logging
process.env.NODE_ENV = 'test';

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
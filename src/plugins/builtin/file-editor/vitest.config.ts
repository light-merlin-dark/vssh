import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: [path.resolve(__dirname, '../../../../tests/setup.ts')],
    testTimeout: 10000,
    isolate: true,
    pool: 'forks',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/', '*.config.ts']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../../../src'),
      '@test-utils': path.resolve(__dirname, '../../../../tests/test-utils')
    }
  }
});
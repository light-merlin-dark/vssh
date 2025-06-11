import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'tests/**',
        'vitest.config.ts',
        // Exclude plugin implementations - they have their own tests
        'src/plugins/builtin/**',
        // Exclude main entry points - these are integration points
        'src/index.ts',
        'src/mcp-server.ts',
        'src/proxy.ts',
        'src/cli/**',
        // Exclude SSH service - integration tested via plugins
        'src/services/ssh.ts',
        // Exclude types - no logic to test
        'src/types/**'
      ],
      include: [
        'src/services/command-guard*.ts',
        'src/plugins/registry.ts',
        'src/plugins/loader.ts',
        'src/config.ts'
      ],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 55,
        statements: 55
      }
    },
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    setupFiles: ['./tests/setup.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests'),
      '@vssh/test-utils': path.resolve(__dirname, './tests/test-utils')
    }
  }
});
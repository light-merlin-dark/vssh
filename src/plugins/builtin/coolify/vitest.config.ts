import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node'
  },
  resolve: {
    alias: {
      '@vssh/test-utils': path.resolve(__dirname, '../../../../tests/test-utils')
    }
  }
});
import { describe, it, expect, spyOn, beforeEach } from 'bun:test';
import { loadConfig } from '../../src/config';
import * as fs from 'fs';

describe('Config', () => {
  beforeEach(() => {
    // Reset all spies before each test
  });

  it('should return null when no config exists and no env vars', () => {
    spyOn(fs, 'existsSync').mockReturnValue(false);
    spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

    // Clear env vars
    delete process.env.VSSH_HOST;
    delete process.env.SSH_HOST;

    const config = loadConfig();

    expect(config).toBeNull();
  });
  
  it('should load config from file when it exists', () => {
    const mockConfig = {
      host: 'test.com',
      user: 'testuser',
      keyPath: '/test/key',
      localMode: false,
      plugins: { enabled: ['docker'] }
    };

    spyOn(fs, 'existsSync').mockReturnValue(true);
    spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(mockConfig) as any);
    spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

    const config = loadConfig();

    expect(config).toEqual(mockConfig);
  });
  
  it('should load config from environment variables', () => {
    spyOn(fs, 'existsSync').mockReturnValue(false);
    spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

    process.env.VSSH_HOST = 'env.test.com';
    process.env.VSSH_USER = 'envuser';
    process.env.VSSH_KEY_PATH = '/env/key';

    const config = loadConfig();

    expect(config).toMatchObject({
      host: 'env.test.com',
      user: 'envuser',
      keyPath: '/env/key'
    });

    // Cleanup
    delete process.env.VSSH_HOST;
    delete process.env.VSSH_USER;
    delete process.env.VSSH_KEY_PATH;
  });
});
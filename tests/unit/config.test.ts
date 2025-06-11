import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig } from '../../src/config';
import * as fs from 'fs';

vi.mock('fs');

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  it('should return null when no config exists and no env vars', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
    
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
    
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
    
    const config = loadConfig();
    
    expect(config).toEqual(mockConfig);
  });
  
  it('should load config from environment variables', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as any);
    
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
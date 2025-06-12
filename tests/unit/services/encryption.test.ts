import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EncryptionService } from '../../../src/services/encryption';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CONFIG_PATH } from '../../../src/config';

// Mock fs module
vi.mock('fs');

describe('EncryptionService', () => {
  let mockFS: any;
  let mockConfig: any;
  
  beforeEach(() => {
    mockFS = fs as any;
    vi.clearAllMocks();
    
    // Default mock config without encryption key
    mockConfig = {
      host: 'test.example.com',
      user: 'testuser',
      keyPath: '/home/test/.ssh/id_rsa'
    };
    
    // Setup default mocks
    mockFS.existsSync = vi.fn().mockReturnValue(false);
    mockFS.readFileSync = vi.fn();
    mockFS.writeFileSync = vi.fn();
    
    // Clear singleton instance
    (EncryptionService as any).instance = undefined;
  });
  
  it('should create a new key if none exists', () => {
    // Mock config exists but no encryption key
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    
    // Encrypt something to trigger key generation
    const encrypted = service.encrypt('test');
    
    // Verify that config was updated with encryption key
    expect(mockFS.writeFileSync).toHaveBeenCalledWith(
      CONFIG_PATH,
      expect.any(String),
      { mode: 0o600 }
    );
    
    // Check that the saved config contains an encryption key
    const savedConfig = JSON.parse(mockFS.writeFileSync.mock.calls[0][1]);
    expect(savedConfig.encryptionKey).toBeDefined();
    expect(savedConfig.encryptionKey).toMatch(/^[A-Za-z0-9+/]+=*$/); // Base64 pattern
  });
  
  it('should reuse existing key', () => {
    // Mock config with existing encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service1 = EncryptionService.getInstance();
    const encrypted1 = service1.encrypt('test');
    
    // Clear instance
    (EncryptionService as any).instance = undefined;
    
    const service2 = EncryptionService.getInstance();
    const encrypted2 = service2.encrypt('test');
    
    // Both instances should decrypt each other's data
    expect(service1.decrypt(encrypted2)).toBe('test');
    expect(service2.decrypt(encrypted1)).toBe('test');
  });
  
  it('should encrypt and decrypt text correctly', () => {
    // Mock config without encryption key to trigger generation
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const plaintext = 'This is a secret message!';
    
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });
  
  it('should encrypt and decrypt objects correctly', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const obj = {
      username: 'admin',
      password: 'secretPassword123',
      url: 'https://grafana.example.com'
    };
    
    const encrypted = service.encryptObject(obj);
    const decrypted = service.decryptObject(encrypted);
    
    expect(decrypted).toEqual(obj);
  });
  
  it('should produce different ciphertexts for same plaintext', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const plaintext = 'Same text';
    
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    
    expect(encrypted1).not.toBe(encrypted2); // Due to random IV
    expect(service.decrypt(encrypted1)).toBe(plaintext);
    expect(service.decrypt(encrypted2)).toBe(plaintext);
  });
  
  it('should throw error for invalid encrypted data', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    
    expect(() => service.decrypt('invalid')).toThrow('Invalid encrypted data format');
    expect(() => service.decrypt('aa:bb')).toThrow('Invalid encrypted data format');
    expect(() => service.decrypt('aa:bb:cc:dd')).toThrow('Invalid encrypted data format');
  });
  
  it('should throw error for tampered data', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const encrypted = service.encrypt('test');
    
    // Tamper with the encrypted data
    const parts = encrypted.split(':');
    parts[2] = parts[2].substring(0, parts[2].length - 2) + 'ff';
    const tampered = parts.join(':');
    
    expect(() => service.decrypt(tampered)).toThrow();
  });
  
  it('should handle empty strings', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const encrypted = service.encrypt('');
    const decrypted = service.decrypt(encrypted);
    
    expect(decrypted).toBe('');
  });
  
  it('should handle unicode text', () => {
    // Mock config with encryption key
    // Generate a proper 32-byte key for AES-256 (64 hex chars = 32 bytes)
    const existingKey = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex').toString('base64');
    mockConfig.encryptionKey = existingKey;
    mockFS.existsSync.mockReturnValue(true);
    mockFS.readFileSync.mockReturnValue(JSON.stringify(mockConfig));
    
    const service = EncryptionService.getInstance();
    const plaintext = '🔐 Sécurité 密码 パスワード';
    
    const encrypted = service.encrypt(plaintext);
    const decrypted = service.decrypt(encrypted);
    
    expect(decrypted).toBe(plaintext);
  });
});
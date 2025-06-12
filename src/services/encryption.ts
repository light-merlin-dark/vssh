import * as crypto from 'crypto';
import * as fs from 'fs';
import { CONFIG_PATH } from '../config';

interface ConfigWithEncryption {
  host: string;
  user: string;
  keyPath: string;
  localMode?: boolean;
  encryptionKey?: string; // Base64 encoded encryption key
  plugins?: {
    enabled?: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };
}

export class EncryptionService {
  private static instance: EncryptionService;
  private key: Buffer | null = null;
  private algorithm = 'aes-256-gcm';
  private keyPromise: Promise<Buffer> | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private loadConfig(): ConfigWithEncryption | null {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      // Config doesn't exist or is corrupted
    }
    return null;
  }

  private saveConfig(config: ConfigWithEncryption): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), {
      mode: 0o600 // Read/write for owner only
    });
  }

  private loadOrCreateKey(): Buffer {
    if (this.key) {
      return this.key;
    }

    const config = this.loadConfig();
    
    if (config?.encryptionKey) {
      // Load existing key from config
      this.key = Buffer.from(config.encryptionKey, 'base64');
      return this.key;
    }

    // Generate new key silently for backward compatibility
    this.key = crypto.randomBytes(32);
    
    // Save to config if it exists
    if (config) {
      config.encryptionKey = this.key.toString('base64');
      this.saveConfig(config);
    }

    return this.key;
  }

  encrypt(text: string): string {
    const key = this.loadOrCreateKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv) as crypto.CipherGCM;
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData: string): string {
    const key = this.loadOrCreateKey();
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Safely encrypt an object to JSON string
   */
  encryptObject(obj: any): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Safely decrypt a JSON string back to object
   */
  decryptObject<T = any>(encryptedData: string): T {
    return JSON.parse(this.decrypt(encryptedData));
  }
}

// Export singleton instance for convenience
export const encryption = EncryptionService.getInstance();
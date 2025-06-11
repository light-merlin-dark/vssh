import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';

// Dynamic paths based on user's home directory
export const PROJECT_PATH = path.join(os.homedir(), '.vssh');
export const DATA_PATH = path.join(PROJECT_PATH, 'data');
export const LOGS_PATH = path.join(DATA_PATH, 'logs');
export const CONFIG_PATH = path.join(PROJECT_PATH, 'config.json');

const envSchema = z.object({
  VSSH_HOST: z.string().optional(),
  VSSH_USER: z.string().optional().default('root'),
  VSSH_KEY_PATH: z.string().optional().default(`${process.env.HOME}/.ssh/id_rsa`)
});

const configSchema = z.object({
  host: z.string(),
  user: z.string(),
  keyPath: z.string(),
  plugins: z.object({
    enabled: z.array(z.string()).optional(),
    disabled: z.array(z.string()).optional(),
    config: z.record(z.any()).optional()
  }).optional()
});

export interface Config {
  host: string;
  user: string;
  keyPath: string;
  plugins?: {
    enabled?: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };
}

export function loadConfig(): Config | null {
  // Ensure data directories exist
  fs.mkdirSync(LOGS_PATH, { recursive: true });

  // First try to load from saved config file
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const savedConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
      return configSchema.parse(savedConfig);
    } catch (error: any) {
      console.error('⚠️  Warning: Failed to parse saved config:', error);
    }
  }

  // Fall back to environment variables
  const envConfig = envSchema.safeParse({
    VSSH_HOST: process.env.VSSH_HOST || process.env.SSH_HOST,
    VSSH_USER: process.env.VSSH_USER,
    VSSH_KEY_PATH: process.env.VSSH_KEY_PATH
  });

  if (envConfig.success && envConfig.data.VSSH_HOST) {
    return {
      host: envConfig.data.VSSH_HOST,
      user: envConfig.data.VSSH_USER,
      keyPath: envConfig.data.VSSH_KEY_PATH,
      plugins: {
        enabled: ['docker', 'coolify']  // Default enabled plugins
      }
    };
  }

  // No config found
  return null;
}

export async function setupInteractiveConfig(): Promise<Config> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(prompt, resolve);
    });
  };

  console.log('\n🔧 First-time setup for vssh\n');
  console.log('vssh is an AI-friendly SSH command proxy that helps AI assistants');
  console.log('safely execute commands on remote servers with built-in safety guards.\n');

  // Get SSH host
  const host = await question('SSH host (e.g., example.com or 192.168.1.100): ');
  if (!host) {
    console.error('\n❌ Host is required');
    process.exit(1);
  }

  // Get SSH user
  const user = await question(`SSH user [${process.env.USER || 'root'}]: `) || process.env.USER || 'root';

  // Detect SSH keys
  const defaultKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa');
  const alternativeKeys = ['id_ed25519', 'id_ecdsa', 'id_dsa'];
  let suggestedKey = defaultKeyPath;

  if (!fs.existsSync(defaultKeyPath)) {
    for (const keyName of alternativeKeys) {
      const keyPath = path.join(os.homedir(), '.ssh', keyName);
      if (fs.existsSync(keyPath)) {
        suggestedKey = keyPath;
        break;
      }
    }
  }

  const keyPath = await question(`SSH private key path [${suggestedKey}]: `) || suggestedKey;

  if (!fs.existsSync(keyPath)) {
    console.error(`\n❌ SSH key not found at: ${keyPath}`);
    console.error('Please ensure you have an SSH key set up.');
    process.exit(1);
  }

  rl.close();

  const config: Config = { 
    host, 
    user, 
    keyPath,
    plugins: {
      enabled: ['docker', 'coolify']  // Default enabled plugins
    }
  };

  // Save config
  fs.mkdirSync(PROJECT_PATH, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  console.log(`\n✅ Configuration saved to: ${CONFIG_PATH}`);
  console.log('\nYou can now use vssh to execute commands on your remote server.');
  console.log('Example: vssh ls -la\n');

  return config;
}
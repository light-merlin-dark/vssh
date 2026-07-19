import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline/promises';

const configuredHome = process.env.VSSH_HOME;

export const PROJECT_PATH = configuredHome
  ? path.resolve(configuredHome)
  : path.join(os.homedir(), '.vssh');
export const DATA_PATH = path.join(PROJECT_PATH, 'data');
export const LOGS_PATH = path.join(DATA_PATH, 'logs');
export const CONFIG_PATH = process.env.VSSH_CONFIG_PATH
  ? path.resolve(process.env.VSSH_CONFIG_PATH)
  : path.join(PROJECT_PATH, 'config.json');

export interface Config {
  host: string;
  user?: string;
  keyPath?: string;
  port?: number;
  connectTimeoutSeconds?: number;
  controlPersistSeconds?: number;
  localMode?: boolean;
}

export interface ConfigOverrides {
  host?: string;
  user?: string;
  keyPath?: string;
  port?: number;
}

function parsePositiveInteger(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return parsed;
}

function parsePort(value: unknown, field: string): number | undefined {
  const parsed = parsePositiveInteger(value, field);
  if (parsed !== undefined && parsed > 65_535) {
    throw new Error(`${field} must be between 1 and 65535`);
  }
  return parsed;
}

function expandHome(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function normalizeConfig(value: unknown): Config {
  if (!value || typeof value !== 'object') {
    throw new Error('configuration must be a JSON object');
  }

  const raw = value as Record<string, unknown>;
  const host = typeof raw.host === 'string' ? raw.host.trim() : '';
  if (!host) throw new Error('host is required');

  const user = typeof raw.user === 'string' && raw.user.trim()
    ? raw.user.trim()
    : undefined;
  const keyPath = typeof raw.keyPath === 'string' && raw.keyPath.trim()
    ? path.resolve(expandHome(raw.keyPath.trim()))
    : undefined;

  return {
    host,
    ...(user && { user }),
    ...(keyPath && { keyPath }),
    ...(raw.port !== undefined && { port: parsePort(raw.port, 'port') }),
    connectTimeoutSeconds: parsePositiveInteger(
      raw.connectTimeoutSeconds ?? 30,
      'connectTimeoutSeconds'
    ),
    controlPersistSeconds: parsePositiveInteger(
      raw.controlPersistSeconds ?? 60,
      'controlPersistSeconds'
    ),
    localMode: raw.localMode === true,
  };
}

function environmentConfig(): Partial<Config> {
  const port = process.env.VSSH_PORT;
  return {
    ...(process.env.VSSH_HOST || process.env.SSH_HOST
      ? { host: (process.env.VSSH_HOST || process.env.SSH_HOST)!.trim() }
      : {}),
    ...(process.env.VSSH_USER ? { user: process.env.VSSH_USER.trim() } : {}),
    ...(process.env.VSSH_KEY_PATH
      ? { keyPath: path.resolve(expandHome(process.env.VSSH_KEY_PATH.trim())) }
      : {}),
    ...(port ? { port: parsePort(port, 'VSSH_PORT') } : {}),
  };
}

export function loadConfig(): Config | null {
  let fromFile: Config | null = null;

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      fromFile = normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid VSSH config at ${CONFIG_PATH}: ${message}`);
    }
  }

  const env = environmentConfig();
  if (!fromFile && !env.host) return null;

  return normalizeConfig({
    ...(fromFile ?? {}),
    ...env,
  });
}

export function applyConfigOverrides(config: Config, overrides: ConfigOverrides): Config {
  return normalizeConfig({ ...config, ...overrides });
}

export function saveConfig(config: Config): void {
  const normalized = normalizeConfig(config);
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });

  const temporaryPath = `${CONFIG_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, CONFIG_PATH);
  fs.chmodSync(CONFIG_PATH, 0o600);
}

export function sanitizedConfig(config: Config): Record<string, unknown> {
  return {
    host: config.host,
    user: config.user ?? '(OpenSSH default)',
    keyPath: config.keyPath ?? '(ssh-agent or OpenSSH config)',
    port: config.port ?? 22,
    connectTimeoutSeconds: config.connectTimeoutSeconds ?? 30,
    controlPersistSeconds: config.controlPersistSeconds ?? 60,
    localMode: config.localMode ?? false,
    configPath: CONFIG_PATH,
  };
}

export async function setupInteractiveConfig(): Promise<Config> {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('\nVSSH setup\n');
    console.log('VSSH uses your native OpenSSH client and normal known_hosts policy.');

    const existing = loadConfig();
    const host = (await terminal.question(`SSH host${existing?.host ? ` [${existing.host}]` : ''}: `)).trim()
      || existing?.host
      || '';
    if (!host) throw new Error('SSH host is required');

    const defaultUser = existing?.user ?? '';
    const user = (await terminal.question(`SSH user${defaultUser ? ` [${defaultUser}]` : ' [OpenSSH default]'}: `)).trim()
      || defaultUser
      || undefined;

    const defaultKey = existing?.keyPath ?? '';
    const keyPathInput = (await terminal.question(
      `Private key${defaultKey ? ` [${defaultKey}]` : ' [ssh-agent or OpenSSH config]'}: `
    )).trim();
    const keyPath = keyPathInput
      ? path.resolve(expandHome(keyPathInput))
      : defaultKey || undefined;

    if (keyPath && !fs.existsSync(keyPath)) {
      throw new Error(`SSH key not found: ${keyPath}`);
    }

    const config = normalizeConfig({ ...existing, host, user, keyPath });
    saveConfig(config);
    console.log(`\nConfiguration saved to ${CONFIG_PATH}`);
    console.log('Run `vssh doctor` to verify the connection.\n');
    return config;
  } finally {
    terminal.close();
  }
}

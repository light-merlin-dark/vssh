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

/**
 * Words that name a credential *value*, and words that name a *location*. A key
 * carrying both is a path, not a secret: `keyPath` points at a private key,
 * `secretFile` at a file, `keyId` at a value-blind identifier. Only a key with a
 * credential word and no location word is treated as holding a value.
 *
 * Matching is token-wise rather than substring so camelCase is seen. The obvious
 * `/\bkey\b/i` cannot match `encryptionKey`: `n` and `K` are both word
 * characters, so the leading word boundary never occurs. That is the exact key
 * this guard exists to catch.
 */
const CREDENTIAL_WORDS = new Set([
  'token', 'tokens', 'secret', 'secrets', 'password', 'passwd', 'passphrase',
  'credential', 'credentials', 'bearer', 'key', 'keys', 'auth', 'apikey',
]);

const LOCATION_WORDS = new Set([
  'path', 'file', 'dir', 'directory', 'location', 'url', 'uri', 'endpoint',
  'host', 'id', 'name', 'type', 'mode', 'enabled', 'disabled', 'source',
]);

/** Top-level keys this file legitimately holds; never scanned, never stripped. */
const SCHEMA_KEYS = new Set([
  'host', 'user', 'keyPath', 'port', 'connectTimeoutSeconds',
  'controlPersistSeconds', 'localMode',
]);

function keyTokens(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((token) => token.toLowerCase());
}

function isCredentialShaped(key: string): boolean {
  const tokens = keyTokens(key);
  return tokens.some((token) => CREDENTIAL_WORDS.has(token))
    && !tokens.some((token) => LOCATION_WORDS.has(token));
}

/**
 * Every credential-shaped key in a parsed config, as dotted paths. Names keys
 * only — never values — so the result is safe to print, log, and assert on.
 */
export function findCredentialKeys(value: unknown, trail: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findCredentialKeys(entry, [...trail, String(index)]));
  }
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    if (trail.length === 0 && SCHEMA_KEYS.has(key)) return [];
    if (isCredentialShaped(key)) return [[...trail, key].join('.')];
    return findCredentialKeys(child, [...trail, key]);
  });
}

/**
 * The config with every credential-shaped key removed. Unknown but benign keys
 * (`plugins`, `usage`) are preserved: this heals a credential off disk, it does
 * not normalize the file, and silently discarding a user's plugin state to
 * remove one field would be a worse trade than the one it fixes.
 */
export function stripCredentialKeys(value: unknown): {
  cleaned: unknown;
  found: string[];
} {
  const found = findCredentialKeys(value);

  const prune = (node: unknown, trail: string[]): unknown => {
    if (Array.isArray(node)) return node.map((entry, index) => prune(entry, [...trail, String(index)]));
    if (node === null || typeof node !== 'object') return node;
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => (trail.length === 0 && SCHEMA_KEYS.has(key)) || !isCredentialShaped(key))
        .map(([key, child]) => [key, prune(child, [...trail, key])])
    );
  };

  return { cleaned: prune(value, []), found };
}

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

/**
 * Rewrite the config with the credential-shaped keys gone, at 0600, and say so
 * naming the keys and never the values.
 *
 * `normalizeConfig` drops unknown keys in memory, so a credential here is
 * already inert — and that is exactly how one survives. VSSH 1.x stored an
 * `encryptionKey` in this file; VSSH 2 removed the reader but not the stored
 * value, which then sat on disk for months, invisible to `config show` and to
 * every other value-free surface. The only way to see it was to open the file,
 * and doing that is what eventually printed it into a transcript. A loader that
 * silently ignores a key cannot tell anyone it is there.
 *
 * Warn loudly, permit, record: a stale credential must never stop `vssh` from
 * running a command.
 */
function healCredentialKeys(raw: unknown): void {
  const { cleaned, found } = stripCredentialKeys(raw);
  if (found.length === 0) return;

  try {
    const temporaryPath = `${CONFIG_PATH}.${process.pid}.heal`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(cleaned, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporaryPath, CONFIG_PATH);
    fs.chmodSync(CONFIG_PATH, 0o600);
    console.warn(
      `Warning: removed credential-shaped ${found.length === 1 ? 'key' : 'keys'} from `
      + `${CONFIG_PATH}: ${found.join(', ')}. This file holds connection settings only; `
      + 'credentials belong in Secure Control. If that value was real, treat it as exposed '
      + 'and revoke it — it was on disk, not in custody.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: ${CONFIG_PATH} holds credential-shaped ${found.length === 1 ? 'key' : 'keys'} `
      + `(${found.join(', ')}) and could not be healed: ${message}. Remove ${found.length === 1 ? 'it' : 'them'} by hand.`
    );
  }
}

/** Tighten a world- or group-readable config back to owner-only. */
function healFileMode(): void {
  try {
    const mode = fs.statSync(CONFIG_PATH).mode & 0o777;
    if ((mode & 0o077) === 0) return;
    fs.chmodSync(CONFIG_PATH, 0o600);
    console.warn(
      `Warning: ${CONFIG_PATH} was mode ${mode.toString(8).padStart(4, '0')}; tightened to 0600.`
    );
  } catch {
    // Mode healing is best-effort and never blocks a command.
  }
}

export function loadConfig(): Config | null {
  let fromFile: Config | null = null;

  if (fs.existsSync(CONFIG_PATH)) {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      fromFile = normalizeConfig(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid VSSH config at ${CONFIG_PATH}: ${message}`);
    }
    healCredentialKeys(raw);
    healFileMode();
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

  // Refuse to write one rather than persist it. `normalizeConfig` should already
  // have dropped it; this is the backstop for a future field that slips into the
  // schema carrying a value.
  const offending = findCredentialKeys(normalized);
  if (offending.length > 0) {
    throw new Error(
      `Refusing to write credential-shaped ${offending.length === 1 ? 'key' : 'keys'} to `
      + `${CONFIG_PATH}: ${offending.join(', ')}. Credentials belong in Secure Control.`
    );
  }

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

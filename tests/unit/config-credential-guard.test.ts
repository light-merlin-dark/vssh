import { afterEach, describe, expect, it } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { findCredentialKeys, stripCredentialKeys } from '../../src/config';

/**
 * Trap for incident 2026-08-22-vssh-config-encryption-key-transcript-exposure.
 *
 * `~/.vssh/config.json` carried an `encryptionKey` from the 1.x Grafana plugin
 * long after VSSH 2 stopped reading it. `normalizeConfig` dropped it in memory
 * and nothing ever said it was on disk, so the only way to see the file's
 * contents was to read the file — which is what an agent enumerating SSH
 * targets did, printing the value into a transcript.
 *
 * The rule under test is therefore not "parse the config" but "a credential in
 * this file is reported and healed off disk, loudly, without blocking a
 * command".
 */

const temporaryRoots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vssh-guard-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    fs.rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

/**
 * `CONFIG_PATH` is resolved once at module load, so a test that only reassigns
 * the environment in-process would operate on the operator's real config. Every
 * loader case runs in its own subprocess with `VSSH_CONFIG_PATH` set before the
 * module is imported.
 */
function loadInSubprocess(configPath: string): { stderr: string; stdout: string; code: number } {
  const result = spawnSync(
    process.execPath,
    ['-e', 'const c = require("./src/config.ts"); console.log(JSON.stringify(c.loadConfig()));'],
    {
      cwd: path.resolve(import.meta.dir, '../..'),
      env: { ...process.env, VSSH_CONFIG_PATH: configPath },
      encoding: 'utf8',
    }
  );
  return { stderr: result.stderr ?? '', stdout: result.stdout ?? '', code: result.status ?? -1 };
}

/** The exact top-level key set the live file carried, with a synthetic value. */
const SENTINEL = 'SYNTHETIC-NOT-A-REAL-KEY-0000000000000000';

function historicalConfig(): Record<string, unknown> {
  return {
    encryptionKey: SENTINEL,
    host: 'example.invalid',
    keyPath: '/tmp/id_rsa',
    localMode: false,
    plugins: { disabled: [], enabled: ['docker'] },
    usage: { commands: { dls: 3 }, lastUpdated: '2026-01-01', plugins: {} },
    user: 'root',
  };
}

describe('credential-shaped key detection', () => {
  it('names encryptionKey, which a word-boundary regex cannot see', () => {
    expect(findCredentialKeys(historicalConfig())).toEqual(['encryptionKey']);

    // The shape cf-cli uses. Recorded so the divergence is deliberate, not drift:
    // `n` and `K` are both word characters, so the leading boundary never occurs.
    expect(/(token|secret|password|credential|bearer|api[_-]?key|\bkey\b)/i.test('encryptionKey'))
      .toBe(false);
  });

  it('leaves keyPath alone — a location, not a value', () => {
    expect(findCredentialKeys({ keyPath: '/tmp/id_rsa' })).toEqual([]);
    expect(findCredentialKeys({ keyId: 'abc', secretFile: '/tmp/s' })).toEqual([]);
  });

  it('catches credential keys nested inside plugin state', () => {
    expect(findCredentialKeys({ plugins: { grafana: { apiKey: 'x', url: 'https://g' } } }))
      .toEqual(['plugins.grafana.apiKey']);
  });

  it('preserves benign unknown keys while stripping the credential', () => {
    const { cleaned, found } = stripCredentialKeys(historicalConfig());
    expect(found).toEqual(['encryptionKey']);
    expect(cleaned).toMatchObject({
      host: 'example.invalid',
      keyPath: '/tmp/id_rsa',
      plugins: { enabled: ['docker'] },
      user: 'root',
    });
    expect(cleaned).not.toHaveProperty('encryptionKey');
    expect(cleaned).toHaveProperty('usage');
  });
});

describe('loadConfig heals the file', () => {
  it('strips the credential, keeps plugin state, and never prints the value', () => {
    const root = makeRoot();
    const configPath = path.join(root, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(historicalConfig(), null, 2), { mode: 0o644 });

    const first = loadInSubprocess(configPath);
    expect(first.code).toBe(0);

    // Reported by name...
    expect(first.stderr).toContain('encryptionKey');
    // ...and the value appears nowhere in either stream.
    expect(first.stderr).not.toContain(SENTINEL);
    expect(first.stdout).not.toContain(SENTINEL);

    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(onDisk).not.toHaveProperty('encryptionKey');
    expect(onDisk.plugins).toEqual({ disabled: [], enabled: ['docker'] });
    expect(onDisk.host).toBe('example.invalid');
    expect(fs.readFileSync(configPath, 'utf8')).not.toContain(SENTINEL);

    // The command still worked: warn loudly, permit, record.
    expect(JSON.parse(first.stdout).host).toBe('example.invalid');

    // Silent on the healed file.
    const second = loadInSubprocess(configPath);
    expect(second.code).toBe(0);
    expect(second.stderr).not.toContain('encryptionKey');
  });

  /**
   * Article III: a rule proven only against a fixture is theatre. This runs the
   * real pre-fix loader — `src/config.ts` as of `fefaa74`, the commit this branch
   * departs from — over the same file, and asserts the defect reproduces.
   */
  it('reproduces the defect on the real pre-fix loader at fefaa74', () => {
    const repoRoot = path.resolve(import.meta.dir, '../..');
    const historical = spawnSync('git', ['show', 'fefaa74:src/config.ts'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    expect(historical.status).toBe(0);

    const root = makeRoot();
    const configPath = path.join(root, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(historicalConfig(), null, 2), { mode: 0o644 });

    const modulePath = path.join(root, 'config.ts');
    fs.writeFileSync(modulePath, historical.stdout);

    const before = spawnSync(
      process.execPath,
      ['-e', `const c = require(${JSON.stringify(modulePath)}); c.loadConfig();`],
      { env: { ...process.env, VSSH_CONFIG_PATH: configPath }, encoding: 'utf8' }
    );

    expect(before.status).toBe(0);
    // The defect: the credential is still on disk, still world-readable, and the
    // loader said nothing about either.
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toHaveProperty('encryptionKey');
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o644);
    expect(before.stderr ?? '').not.toContain('encryptionKey');

    // Same file, same input, current loader: healed and reported.
    const after = loadInSubprocess(configPath);
    expect(after.code).toBe(0);
    expect(after.stderr).toContain('encryptionKey');
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).not.toHaveProperty('encryptionKey');
  });

  it('tightens a world-readable config to owner-only', () => {
    const root = makeRoot();
    const configPath = path.join(root, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify({ host: 'example.invalid' }), { mode: 0o644 });

    expect(loadInSubprocess(configPath).code).toBe(0);
    expect(fs.statSync(configPath).mode & 0o777).toBe(0o600);
  });
});

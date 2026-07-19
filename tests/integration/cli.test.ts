import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

const cliPath = path.join(import.meta.dir, '../../src/index.ts');
const fakeBin = path.join(import.meta.dir, '../fixtures/fake-bin');

describe('VSSH CLI', () => {
  let home: string;
  let sshLog: string;
  let scpLog: string;

  beforeEach(() => {
    home = mkdtempSync(path.join(tmpdir(), 'vssh-test-'));
    sshLog = path.join(home, 'ssh.jsonl');
    scpLog = path.join(home, 'scp.jsonl');
  });

  afterEach(() => rmSync(home, { recursive: true, force: true }));

  function run(args: string[], input?: string) {
    return spawnSync(process.execPath, [cliPath, ...args], {
      encoding: 'utf8',
      input,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        VSSH_HOME: home,
        VSSH_HOST: 'fake-host',
        FAKE_SSH_LOG: sshLog,
        FAKE_SCP_LOG: scpLog,
      },
    });
  }

  it('streams stdout/stderr and propagates the remote exit code', () => {
    const execution = run(['printf "out"; printf "err" >&2; exit 7']);
    expect(execution.status).toBe(7);
    expect(execution.stdout).toBe('out');
    expect(execution.stderr).toBe('err');
  });

  it('returns one structured JSON object on remote failure', () => {
    const execution = run(['--json', 'printf "out"; printf "err" >&2; exit 9']);
    expect(execution.status).toBe(9);
    expect(execution.stderr).toBe('');
    expect(JSON.parse(execution.stdout)).toMatchObject({
      success: false,
      transport: 'ssh',
      exitCode: 9,
      stdout: 'out',
      stderr: 'err',
    });
  });

  it('forwards piped stdin to the remote command', () => {
    const execution = run(['cat'], 'hello over stdin\n');
    expect(execution.status).toBe(0);
    expect(execution.stdout).toBe('hello over stdin\n');
  });

  it('quotes multiple local argv values before remote execution', () => {
    const execution = run(['printf', '%s', 'hello world']);
    expect(execution.status).toBe(0);
    expect(execution.stdout).toBe('hello world');
  });

  it('times out with the conventional exit code 124', () => {
    const execution = run(['--json', '--timeout', '0.05', 'sleep 2']);
    expect(execution.status).toBe(124);
    expect(JSON.parse(execution.stdout)).toMatchObject({ timedOut: true, exitCode: 124 });
  });

  it('blocks catastrophic commands before invoking ssh', () => {
    const execution = run(['rm -fr /']);
    expect(execution.status).toBe(126);
    expect(execution.stderr).toContain('Command blocked');
    expect(() => readFileSync(sshLog, 'utf8')).toThrow();
  });

  it('applies the command guard to legacy run aliases', () => {
    const execution = run(['run', 'rm -fr /']);
    expect(execution.status).toBe(126);
    expect(execution.stderr).toContain('Command blocked');
    expect(() => readFileSync(sshLog, 'utf8')).toThrow();
  });

  it('prints compatibility usage errors in raw mode', () => {
    const execution = run(['sdl']);
    expect(execution.status).toBe(2);
    expect(execution.stderr).toContain('Usage: vssh sdl');
  });

  it('does not treat remote --json arguments as a global output flag', () => {
    const execution = run(['echo', '--json']);
    expect(execution.status).toBe(0);
    expect(execution.stdout).toBe('--json\n');
  });

  it('does not persist command contents or output in the audit log', () => {
    const execution = run(['printf super-secret-output']);
    expect(execution.status).toBe(0);
    const audit = readFileSync(path.join(home, 'data/logs/commands.jsonl'), 'utf8');
    expect(audit).not.toContain('super-secret-output');
    expect(JSON.parse(audit)).toHaveProperty('commandHash');
  });

  it('routes uploads through native scp and reports JSON', () => {
    const localFile = path.join(home, 'artifact.txt');
    writeFileSync(localFile, 'artifact');
    const execution = run(['--json', 'upload', localFile, '/tmp/artifact.txt']);
    expect(execution.status).toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({ success: true, transport: 'scp' });
    const scpArgs = JSON.parse(readFileSync(scpLog, 'utf8').trim());
    expect(scpArgs.at(-2)).toBe(localFile);
    expect(scpArgs.at(-1)).toBe('fake-host:/tmp/artifact.txt');
  });

  it('sets an uploaded file mode as part of one CLI operation', () => {
    const localFile = path.join(home, 'private.txt');
    writeFileSync(localFile, 'private', { mode: 0o644 });
    const execution = run(['--json', 'upload', '--mode', '600', localFile, localFile]);
    expect(execution.status).toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({ success: true, transport: 'scp' });
    expect(statSync(localFile).mode & 0o777).toBe(0o600);
    const sshArgs = JSON.parse(readFileSync(sshLog, 'utf8').trim());
    expect(sshArgs.at(-1)).toContain('chmod 600');
  });

  it('rejects invalid upload modes before invoking scp', () => {
    const execution = run(['upload', '--mode', '999', 'source', 'target']);
    expect(execution.status).toBe(1);
    expect(execution.stderr).toContain('octal');
    expect(() => readFileSync(scpLog, 'utf8')).toThrow();
  });

  it('fails the upload operation when its permission change fails', () => {
    const localFile = path.join(home, 'source.txt');
    const missingRemote = path.join(home, 'missing-remote.txt');
    writeFileSync(localFile, 'source');
    const execution = run(['--json', 'upload', '--mode=600', localFile, missingRemote]);
    expect(execution.status).not.toBe(0);
    expect(JSON.parse(execution.stdout)).toMatchObject({ success: false, transport: 'scp' });
  });

  it('exposes machine-readable discovery without an SSH connection', () => {
    const execution = run(['commands', '--json']);
    expect(execution.status).toBe(0);
    const output = JSON.parse(execution.stdout);
    expect(output.schemaVersion).toBe(1);
    expect(output.version).toBe('2.0.0');
    expect(output.defaultCommand).toBe('exec');
    expect(output.globalOptions.some((option: { name: string }) => option.name === '--json')).toBe(true);
    expect(output.commands.find((command: { name: string }) => command.name === 'upload')).toMatchObject({
      aliases: [],
      usage: 'vssh upload [--mode <octal>] <local> <remote>',
      kind: 'core',
    });
    expect(output.commands.find((command: { name: string }) => command.name === 'lcd')).toMatchObject({
      aliases: ['ldc'],
      kind: 'compatibility',
    });
    expect(new Set(output.commands.map((command: { name: string }) => command.name)).size).toBe(output.commands.length);
  });
});

import { describe, expect, it } from 'bun:test';
import { buildScpArgs, buildSshArgs, remoteLocation } from '../../../src/services/ssh';
import type { Config } from '../../../src/config';

const config: Config = {
  host: 'server.example',
  user: 'deploy',
  keyPath: '/tmp/id_ed25519',
  port: 2222,
  connectTimeoutSeconds: 12,
  controlPersistSeconds: 90,
};

describe('native OpenSSH argument construction', () => {
  it('uses host verification defaults and connection reuse without a shell', () => {
    const args = buildSshArgs(config, 'echo ok');
    expect(args).toContain('BatchMode=yes');
    expect(args).toContain('ControlMaster=auto');
    expect(args).toContain('ControlPersist=90s');
    expect(args).not.toContain('StrictHostKeyChecking=no');
    expect(args.slice(-3)).toEqual(['--', 'deploy@server.example', 'echo ok']);
  });

  it('uses scp port syntax and preserves each path as one argv value', () => {
    const args = buildScpArgs(config, '/tmp/hello world', 'deploy@server.example:/tmp/target');
    expect(args).toContain('-P');
    expect(args).not.toContain('-p');
    expect(args.slice(-2)).toEqual(['/tmp/hello world', 'deploy@server.example:/tmp/target']);
  });

  it('builds remote locations from the configured identity', () => {
    expect(remoteLocation(config, '/tmp/file')).toBe('deploy@server.example:/tmp/file');
  });
});

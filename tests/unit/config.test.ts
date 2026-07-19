import { describe, expect, it } from 'bun:test';
import { applyConfigOverrides, sanitizedConfig } from '../../src/config';

describe('configuration', () => {
  it('applies explicit connection overrides', () => {
    const config = applyConfigOverrides(
      { host: 'default.example', user: 'root', port: 22 },
      { host: 'other.example', user: 'deploy', port: 2222 }
    );

    expect(config).toMatchObject({
      host: 'other.example',
      user: 'deploy',
      port: 2222,
      connectTimeoutSeconds: 30,
      controlPersistSeconds: 60,
    });
  });

  it('shows only non-secret effective configuration', () => {
    const shown = sanitizedConfig({ host: 'server', user: 'root', keyPath: '/tmp/id' });
    expect(shown).toMatchObject({ host: 'server', user: 'root', keyPath: '/tmp/id' });
    expect(shown).not.toHaveProperty('password');
    expect(shown).not.toHaveProperty('encryptionKey');
  });

  it('rejects invalid ports', () => {
    expect(() => applyConfigOverrides({ host: 'server' }, { port: 0 })).toThrow('port');
    expect(() => applyConfigOverrides({ host: 'server' }, { port: 65_536 })).toThrow('65535');
  });
});

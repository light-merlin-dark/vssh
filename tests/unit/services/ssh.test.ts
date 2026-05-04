import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Config } from '../../../src/config';

type UploadCall = {
  localPath: string;
  remotePath: string;
};

type DownloadCall = {
  remotePath: string;
  localPath: string;
};

let uploadCalls: UploadCall[] = [];
let downloadCalls: DownloadCall[] = [];
let endCalls = 0;
let connectOptions: Record<string, unknown> | null = null;

class MockClient {
  private handlers = new Map<string, Array<(...args: any[]) => void>>();

  on(event: string, handler: (...args: any[]) => void) {
    const existing = this.handlers.get(event) ?? [];
    existing.push(handler);
    this.handlers.set(event, existing);
    return this;
  }

  connect(options: Record<string, unknown>) {
    connectOptions = options;
    queueMicrotask(() => {
      this.emit('ready');
    });
    return this;
  }

  sftp(callback: (error: Error | null, sftp: {
    fastPut: (localPath: string, remotePath: string, cb: (error?: Error | null) => void) => void;
    fastGet: (remotePath: string, localPath: string, cb: (error?: Error | null) => void) => void;
  }) => void) {
    callback(null, {
      fastPut: (localPath, remotePath, cb) => {
        uploadCalls.push({ localPath, remotePath });
        queueMicrotask(() => cb(null));
      },
      fastGet: (remotePath, localPath, cb) => {
        downloadCalls.push({ remotePath, localPath });
        queueMicrotask(() => cb(null));
      },
    });
  }

  end() {
    endCalls += 1;
  }

  private emit(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

mock.module('ssh2', () => ({
  Client: MockClient,
}));

describe('SSHService transfers', () => {
  let tempDir: string;
  let config: Config;

  beforeEach(() => {
    uploadCalls = [];
    downloadCalls = [];
    endCalls = 0;
    connectOptions = null;

    tempDir = mkdtempSync(join(tmpdir(), 'vssh-ssh-test-'));
    const keyPath = join(tempDir, 'id_rsa');
    writeFileSync(keyPath, 'fake-private-key');

    config = {
      host: 'example.com',
      user: 'root',
      keyPath,
    };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('uploads files through fastPut and closes the connection', async () => {
    const { SSHService } = await import('../../../src/services/ssh');
    const sshService = new SSHService(config);

    await sshService.uploadFile('/tmp/local.txt', '/tmp/remote.txt');

    expect(uploadCalls).toEqual([
      { localPath: '/tmp/local.txt', remotePath: '/tmp/remote.txt' },
    ]);
    expect(downloadCalls).toEqual([]);
    expect(endCalls).toBe(1);
    expect(connectOptions).toMatchObject({
      host: 'example.com',
      username: 'root',
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      readyTimeout: 30_000,
    });
  });

  it('downloads files through fastGet and closes the connection', async () => {
    const { SSHService } = await import('../../../src/services/ssh');
    const sshService = new SSHService(config);

    await sshService.downloadFile('/tmp/remote.txt', '/tmp/local.txt');

    expect(downloadCalls).toEqual([
      { remotePath: '/tmp/remote.txt', localPath: '/tmp/local.txt' },
    ]);
    expect(uploadCalls).toEqual([]);
    expect(endCalls).toBe(1);
  });
});

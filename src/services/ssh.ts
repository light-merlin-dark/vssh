import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import type { Config } from '../config';

export class SSHService {
  constructor(private config: Config) {}

  private getConnectionOptions() {
    return {
      host: this.config.host,
      username: this.config.user,
      privateKey: readFileSync(this.config.keyPath),
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      readyTimeout: 30_000,
    };
  }

  async executeCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.exec(command, (err, stream) => {
            if (err) return reject(err);

            let data = '';
            stream
              .on('data', (chunk: Buffer) => (data += chunk.toString()))
              .on('close', () => {
                conn.end();
                resolve(data.trimEnd());
              })
              .stderr.on('data', (chunk: Buffer) => {
                data += chunk.toString();
              });
          });
        })
        .on('error', reject)
        .connect(this.getConnectionOptions());
    });
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        conn.end();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              finish(err);
              return;
            }

            sftp.fastPut(localPath, remotePath, (putError) => {
              finish(putError ?? undefined);
            });
          });
        })
        .on('error', (error) => {
          finish(error);
        })
        .connect(this.getConnectionOptions());
    });
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        conn.end();
        if (error) {
          reject(error);
          return;
        }
        resolve();
      };

      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              finish(err);
              return;
            }

            sftp.fastGet(remotePath, localPath, (getError) => {
              finish(getError ?? undefined);
            });
          });
        })
        .on('error', (error) => {
          finish(error);
        })
        .connect(this.getConnectionOptions());
    });
  }

  async getFileInfo(remotePath: string): Promise<{ size: number; mtime: Date; mode: number }> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            sftp.stat(remotePath, (err, stats) => {
              conn.end();
              if (err) return reject(err);
              resolve({
                size: stats.size,
                mtime: new Date(stats.mtime * 1000),
                mode: stats.mode
              });
            });
          });
        })
        .on('error', reject)
        .connect(this.getConnectionOptions());
    });
  }
}

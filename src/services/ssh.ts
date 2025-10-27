import { Client } from 'ssh2';
import { readFileSync, createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import type { Config } from '../config';

export class SSHService {
  constructor(private config: Config) {}

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
        .connect({
          host: this.config.host,
          username: this.config.user,
          privateKey: readFileSync(this.config.keyPath)
        });
    });
  }

  async uploadFile(localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            const readStream = createReadStream(localPath);
            const writeStream = sftp.createWriteStream(remotePath);

            writeStream.on('close', () => {
              conn.end();
              resolve();
            });

            writeStream.on('error', (err: Error) => {
              conn.end();
              reject(err);
            });

            readStream.on('error', (err: Error) => {
              conn.end();
              reject(err);
            });

            readStream.pipe(writeStream);
          });
        })
        .on('error', reject)
        .connect({
          host: this.config.host,
          username: this.config.user,
          privateKey: readFileSync(this.config.keyPath)
        });
    });
  }

  async downloadFile(remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn
        .on('ready', () => {
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end();
              return reject(err);
            }

            const readStream = sftp.createReadStream(remotePath);
            const writeStream = createWriteStream(localPath);

            writeStream.on('close', () => {
              conn.end();
              resolve();
            });

            writeStream.on('error', (err: Error) => {
              conn.end();
              reject(err);
            });

            readStream.on('error', (err: Error) => {
              conn.end();
              reject(err);
            });

            readStream.pipe(writeStream);
          });
        })
        .on('error', reject)
        .connect({
          host: this.config.host,
          username: this.config.user,
          privateKey: readFileSync(this.config.keyPath)
        });
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
        .connect({
          host: this.config.host,
          username: this.config.user,
          privateKey: readFileSync(this.config.keyPath)
        });
    });
  }
}
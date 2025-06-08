import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import type { SSHConfig } from '../types';

export class SSHService {
  constructor(private config: SSHConfig) {}

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
}
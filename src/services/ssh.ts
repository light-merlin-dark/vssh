import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Config } from '../config';
import { PROJECT_PATH } from '../config';
import { shellQuote } from '../shell';

export type OutputMode = 'inherit' | 'capture';

export interface ExecutionOptions {
  mode?: OutputMode;
  timeoutMs?: number;
  tty?: boolean;
  forwardStdin?: boolean;
  cwd?: string;
}

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: NodeJS.Signals;
  durationMs: number;
  timedOut: boolean;
}

export interface TransferOptions extends ExecutionOptions {
  recursive?: boolean;
  remoteMode?: number;
}

const MAX_CAPTURE_BYTES = 16 * 1024 * 1024;

function expandedPath(filePath: string): string {
  if (filePath === '~') return os.homedir();
  if (filePath.startsWith('~/')) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function destination(config: Config): string {
  return config.user ? `${config.user}@${config.host}` : config.host;
}

function connectionArgs(config: Config): string[] {
  const controlPath = path.join(PROJECT_PATH, 'control-%C');
  const args = [
    '-o', 'BatchMode=yes',
    '-o', `ConnectTimeout=${config.connectTimeoutSeconds ?? 30}`,
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ControlMaster=auto',
    '-o', `ControlPersist=${config.controlPersistSeconds ?? 60}s`,
    '-o', `ControlPath=${controlPath}`,
  ];

  if (config.keyPath) args.push('-i', expandedPath(config.keyPath));
  if (config.port) args.push('-p', String(config.port));
  return args;
}

export function buildSshArgs(config: Config, command: string, tty = false): string[] {
  return [
    ...connectionArgs(config),
    ...(tty ? ['-tt'] : ['-T']),
    '--',
    destination(config),
    command,
  ];
}

export function buildScpArgs(
  config: Config,
  source: string,
  target: string,
  recursive = true
): string[] {
  const args = connectionArgs(config);
  const portIndex = args.indexOf('-p');
  if (portIndex !== -1) args[portIndex] = '-P';

  return [
    ...args,
    ...(recursive ? ['-r'] : []),
    '--',
    source,
    target,
  ];
}

export function remoteLocation(config: Config, remotePath: string): string {
  return `${destination(config)}:${remotePath}`;
}

export class SSHService {
  constructor(private readonly config: Config) {
    fs.mkdirSync(PROJECT_PATH, { recursive: true, mode: 0o700 });
    try {
      fs.chmodSync(PROJECT_PATH, 0o700);
    } catch {
      // Existing directories on unusual filesystems may not support chmod.
    }
  }

  run(command: string, options: ExecutionOptions = {}): Promise<CommandResult> {
    return this.runProcess('ssh', buildSshArgs(this.config, command, options.tty), command, options);
  }

  runLocal(command: string, options: ExecutionOptions = {}): Promise<CommandResult> {
    return this.runProcess('/bin/sh', ['-lc', command], command, options);
  }

  async upload(localPath: string, remotePath: string, options: TransferOptions = {}): Promise<CommandResult> {
    const absoluteLocalPath = path.resolve(expandedPath(localPath));
    const label = `upload ${absoluteLocalPath} ${remotePath}`;
    const startedAt = Date.now();
    const transferred = await this.runProcess(
      'scp',
      buildScpArgs(
        this.config,
        absoluteLocalPath,
        remoteLocation(this.config, remotePath),
        options.recursive ?? true
      ),
      label,
      options
    );
    if (transferred.exitCode !== 0 || options.remoteMode === undefined) return transferred;

    const elapsedMs = Date.now() - startedAt;
    const remainingTimeoutMs = options.timeoutMs === undefined
      ? undefined
      : Math.max(1, options.timeoutMs - elapsedMs);
    if (options.timeoutMs !== undefined && elapsedMs >= options.timeoutMs) {
      return { ...transferred, command: label, exitCode: 124, durationMs: elapsedMs, timedOut: true };
    }

    const target = remotePath === '~'
      ? '"$HOME"'
      : remotePath.startsWith('~/')
        ? `"$HOME"/${shellQuote(remotePath.slice(2))}`
        : shellQuote(remotePath);
    const basename = shellQuote(path.basename(absoluteLocalPath));
    const chmod = await this.run(
      `target=${target}; if [ -d "$target" ]; then target="$target"/${basename}; fi; case "$target" in -*) target="./$target";; esac; chmod ${options.remoteMode.toString(8)} "$target"`,
      { ...options, timeoutMs: remainingTimeoutMs }
    );
    return {
      command: label,
      stdout: transferred.stdout + chmod.stdout,
      stderr: transferred.stderr + chmod.stderr,
      exitCode: chmod.exitCode,
      ...(chmod.signal && { signal: chmod.signal }),
      durationMs: Date.now() - startedAt,
      timedOut: chmod.timedOut,
    };
  }

  download(remotePath: string, localPath: string, options: TransferOptions = {}): Promise<CommandResult> {
    const absoluteLocalPath = path.resolve(expandedPath(localPath));
    fs.mkdirSync(path.dirname(absoluteLocalPath), { recursive: true });
    const label = `download ${remotePath} ${absoluteLocalPath}`;
    return this.runProcess(
      'scp',
      buildScpArgs(
        this.config,
        remoteLocation(this.config, remotePath),
        absoluteLocalPath,
        options.recursive ?? true
      ),
      label,
      options
    );
  }

  private runProcess(
    executable: string,
    args: string[],
    command: string,
    options: ExecutionOptions
  ): Promise<CommandResult> {
    const mode = options.mode ?? 'inherit';
    const startedAt = Date.now();

    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd,
        env: process.env,
        stdio: mode === 'inherit' ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      };
      const child = spawn(executable, args, spawnOptions);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let capturedBytes = 0;
      let timedOut = false;
      let outputLimitExceeded = false;
      let inputError: Error | undefined;
      let forceKillTimer: NodeJS.Timeout | undefined;

      const terminate = (): void => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        child.kill('SIGTERM');
        if (!forceKillTimer) {
          forceKillTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
          }, 1_000);
          forceKillTimer.unref();
        }
      };

      const append = (chunks: Buffer[], chunk: Buffer): void => {
        capturedBytes += chunk.byteLength;
        if (capturedBytes > MAX_CAPTURE_BYTES) {
          outputLimitExceeded = true;
          terminate();
          return;
        }
        chunks.push(chunk);
      };

      if (mode === 'capture') {
        child.stdout?.on('data', (chunk: Buffer) => { append(stdoutChunks, chunk); });
        child.stderr?.on('data', (chunk: Buffer) => { append(stderrChunks, chunk); });
        child.stdin?.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code !== 'EPIPE') {
            inputError = error;
            terminate();
          }
        });

        if (options.forwardStdin && !process.stdin.isTTY && child.stdin) {
          process.stdin.pipe(child.stdin);
        } else {
          child.stdin?.end();
        }
      }

      const forwardedSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
      const signalHandlers = new Map<NodeJS.Signals, () => void>();
      for (const signal of forwardedSignals) {
        const handler = () => child.kill(signal);
        signalHandlers.set(signal, handler);
        process.once(signal, handler);
      }

      const timeout = options.timeoutMs && options.timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            terminate();
          }, options.timeoutMs)
        : undefined;
      timeout?.unref();

      const cleanup = (childProcess: ChildProcess) => {
        if (timeout) clearTimeout(timeout);
        if (forceKillTimer) clearTimeout(forceKillTimer);
        for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
        if (mode === 'capture' && options.forwardStdin && childProcess.stdin) {
          process.stdin.unpipe(childProcess.stdin);
        }
      };

      child.once('error', (error) => {
        cleanup(child);
        reject(new Error(`Failed to start ${executable}: ${error.message}`));
      });

      child.once('close', (code, signal) => {
        cleanup(child);
        if (outputLimitExceeded) {
          reject(new Error(`Command output exceeded ${MAX_CAPTURE_BYTES / 1024 / 1024} MiB capture limit`));
          return;
        }
        if (inputError) {
          reject(new Error(`Failed to forward stdin to ${executable}: ${inputError.message}`));
          return;
        }

        const signalExitCode = signal ? 128 + (os.constants.signals[signal] ?? 0) : 1;
        resolve({
          command,
          stdout: Buffer.concat(stdoutChunks).toString(),
          stderr: Buffer.concat(stderrChunks).toString(),
          exitCode: timedOut ? 124 : code ?? signalExitCode,
          ...(signal && { signal }),
          durationMs: Date.now() - startedAt,
          timedOut,
        });
      });
    });
  }
}

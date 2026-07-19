import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import type { CommandResult, OutputMode } from './services/ssh';
import { SSHService } from './services/ssh';
import { shellQuote } from './shell';

interface EditOperation {
  type: 'replace' | 'regex' | 'insert' | 'delete';
  search?: string;
  replace?: string;
  pattern?: string;
  flags?: string;
  line?: number;
  content?: string;
}

export interface EditCommandOptions {
  mode: OutputMode;
  timeoutMs?: number;
  local: boolean;
}

function result(command: string, stdout: string, stderr = '', exitCode = 0): CommandResult {
  return {
    command,
    stdout,
    stderr,
    exitCode,
    durationMs: 0,
    timedOut: false,
  };
}

function parseArguments(args: string[]): {
  filePath: string;
  operations: EditOperation[];
  dryRun: boolean;
  backup: boolean;
} {
  const filePath = args[0];
  if (!filePath) throw new Error('Usage: vssh ef <path> [edit options]');

  const values = new Map<string, string | boolean>();
  for (let index = 1; index < args.length; index++) {
    const current = args[index];
    if (!current.startsWith('--')) throw new Error(`Unexpected edit argument: ${current}`);
    const key = current.slice(2);
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      values.set(key, next);
      index++;
    } else {
      values.set(key, true);
    }
  }

  const operations: EditOperation[] = [];
  if (values.has('edits')) {
    const encoded = values.get('edits');
    if (typeof encoded !== 'string') throw new Error('--edits requires a JSON value');
    const parsed = JSON.parse(encoded) as EditOperation | EditOperation[];
    operations.push(...(Array.isArray(parsed) ? parsed : [parsed]));
  }

  if (typeof values.get('search') === 'string' && typeof values.get('replace') === 'string') {
    operations.push({
      type: 'replace',
      search: values.get('search') as string,
      replace: values.get('replace') as string,
    });
  }
  if (typeof values.get('regex') === 'string' && typeof values.get('with') === 'string') {
    operations.push({
      type: 'regex',
      pattern: values.get('regex') as string,
      replace: values.get('with') as string,
      ...(typeof values.get('flags') === 'string' && { flags: values.get('flags') as string }),
    });
  }
  if (typeof values.get('insert-at') === 'string' && typeof values.get('content') === 'string') {
    operations.push({
      type: 'insert',
      line: Number(values.get('insert-at')),
      content: values.get('content') as string,
    });
  }
  if (typeof values.get('delete-line') === 'string') {
    operations.push({ type: 'delete', line: Number(values.get('delete-line')) });
  }

  if (operations.length === 0) {
    throw new Error('No edits specified; use --search/--replace, --regex/--with, --insert-at, --delete-line, or --edits');
  }

  return {
    filePath,
    operations,
    dryRun: values.get('dry-run') === true,
    backup: values.get('no-backup') !== true,
  };
}

function applyOperations(original: string, operations: EditOperation[]): string {
  let content = original;

  for (const edit of operations) {
    if (edit.type === 'replace') {
      if (edit.search === undefined || edit.replace === undefined) {
        throw new Error('replace edits require search and replace');
      }
      content = content.split(edit.search).join(edit.replace);
      continue;
    }

    if (edit.type === 'regex') {
      if (edit.pattern === undefined || edit.replace === undefined) {
        throw new Error('regex edits require pattern and replace');
      }
      content = content.replace(new RegExp(edit.pattern, edit.flags ?? 'g'), edit.replace);
      continue;
    }

    const lines = content.split('\n');
    if (!Number.isInteger(edit.line)) throw new Error(`${edit.type} edits require an integer line`);
    const line = edit.line!;

    if (edit.type === 'insert') {
      if (line < 0 || line > lines.length) throw new Error(`Line ${line} is out of range`);
      lines.splice(line, 0, edit.content ?? '');
    } else {
      if (line < 0 || line >= lines.length) throw new Error(`Line ${line} is out of range`);
      lines.splice(line, 1);
    }
    content = lines.join('\n');
  }

  return content;
}

function summarizeDiff(original: string, modified: string): string {
  if (original === modified) return 'No changes made.\n';
  const before = original.split('\n');
  const after = modified.split('\n');
  const changed: string[] = [];
  const length = Math.max(before.length, after.length);

  for (let index = 0; index < length; index++) {
    if (before[index] === after[index]) continue;
    if (before[index] !== undefined) changed.push(`-${index + 1}: ${before[index]}`);
    if (after[index] !== undefined) changed.push(`+${index + 1}: ${after[index]}`);
    if (changed.length >= 80) {
      changed.push('... diff truncated ...');
      break;
    }
  }
  return `${changed.join('\n')}\n`;
}

export async function runEditCommand(
  ssh: SSHService,
  args: string[],
  options: EditCommandOptions
): Promise<CommandResult> {
  const startedAt = Date.now();
  const parsed = parseArguments(args);
  const command = `ef ${parsed.filePath}`;
  let original: string;

  if (options.local) {
    original = await fs.readFile(path.resolve(parsed.filePath), 'utf8');
  } else {
    const read = await ssh.run(`cat -- ${shellQuote(parsed.filePath)}`, {
      mode: 'capture',
      timeoutMs: options.timeoutMs,
    });
    if (read.exitCode !== 0) return { ...read, command };
    original = read.stdout;
  }

  const modified = applyOperations(original, parsed.operations);
  if (parsed.dryRun || modified === original) {
    return {
      ...result(command, summarizeDiff(original, modified)),
      durationMs: Date.now() - startedAt,
    };
  }

  if (options.local) {
    const absolutePath = path.resolve(parsed.filePath);
    if (parsed.backup) await fs.copyFile(absolutePath, `${absolutePath}.vssh.backup`);
    await fs.writeFile(absolutePath, modified, 'utf8');
  } else {
    const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'vssh-edit-'));
    const temporaryLocalPath = path.join(temporaryDirectory, 'content');
    const temporaryRemotePath = `/tmp/vssh-edit-${process.pid}-${randomUUID()}`;

    try {
      await fs.writeFile(temporaryLocalPath, modified, { encoding: 'utf8', mode: 0o600 });
      const uploaded = await ssh.upload(temporaryLocalPath, temporaryRemotePath, {
        mode: 'capture',
        timeoutMs: options.timeoutMs,
        recursive: false,
      });
      if (uploaded.exitCode !== 0) return { ...uploaded, command };

      const target = shellQuote(parsed.filePath);
      const remoteTemp = shellQuote(temporaryRemotePath);
      const writeCommand = [
        'set -eu',
        ...(parsed.backup ? [`cp -p -- ${target} ${shellQuote(`${parsed.filePath}.vssh.backup`)}`] : []),
        `cat -- ${remoteTemp} > ${target}`,
        `rm -f -- ${remoteTemp}`,
      ].join(' && ');
      const written = await ssh.run(writeCommand, {
        mode: 'capture',
        timeoutMs: options.timeoutMs,
      });
      if (written.exitCode !== 0) return { ...written, command };
    } finally {
      await ssh.run(`rm -f -- ${shellQuote(temporaryRemotePath)}`, {
        mode: 'capture',
        timeoutMs: options.timeoutMs,
      }).catch(() => undefined);
      await fs.rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  return {
    ...result(command, `Updated ${parsed.filePath}${parsed.backup ? ' (backup created)' : ''}.\n`),
    durationMs: Date.now() - startedAt,
  };
}

#!/usr/bin/env node
import * as fs from 'fs';
import { spawnSync } from 'child_process';
import {
  applyConfigOverrides,
  loadConfig,
  sanitizedConfig,
  saveConfig,
  setupInteractiveConfig,
  type Config,
  type ConfigOverrides,
} from './config';
import { runCompatibilityCommand } from './compatibility';
import { commandFromArgs } from './shell';
import { writeAuditEvent } from './services/audit-log';
import { CommandGuardService } from './services/command-guard-service';
import { SSHService, type CommandResult, type OutputMode } from './services/ssh';

const packageJson = require('../package.json') as { version: string };
const VERSION = packageJson.version;

interface ParsedGlobalOptions {
  args: string[];
  json: boolean;
  tty: boolean;
  timeoutMs?: number;
  local?: boolean;
  noAudit: boolean;
  literalCommand: boolean;
  forceRaw: boolean;
  overrides: ConfigOverrides;
}

const GLOBAL_OPTIONS = [
  { name: '--json', aliases: [], value: null, description: 'Capture and return one JSON result' },
  { name: '--timeout', aliases: [], value: '<seconds>', description: 'Stop the command after a deadline (exit 124)' },
  { name: '--tty', aliases: ['-t'], value: null, description: 'Request a remote pseudo-terminal' },
  { name: '--host', aliases: [], value: '<host>', description: 'Override the configured host' },
  { name: '--user', aliases: [], value: '<user>', description: 'Override the configured user' },
  { name: '--identity', aliases: ['-i'], value: '<path>', description: 'Override the private key' },
  { name: '--port', aliases: ['-p'], value: '<port>', description: 'Override the SSH port' },
  { name: '--no-audit', aliases: [], value: null, description: 'Do not write bounded command metadata' },
  { name: '--local', aliases: [], value: null, description: 'Run through the local shell for compatibility' },
  { name: '--remote', aliases: [], value: null, description: 'Override local mode and use SSH' },
  { name: '--command', aliases: ['-c'], value: '<command>', description: 'Pass one literal command string' },
  { name: '--', aliases: [], value: '<command...>', description: 'Treat remaining arguments as a raw command' },
] as const;

const COMMANDS = [
  {
    name: 'exec',
    aliases: ['run', 'proxy'],
    usage: 'vssh [options] <command...>',
    kind: 'core',
    implicit: true,
    description: 'Run a command on the configured SSH host; the exec name is normally omitted',
  },
  {
    name: 'upload',
    aliases: [],
    usage: 'vssh upload [--mode <octal>] <local> <remote>',
    kind: 'core',
    description: 'Copy a file or directory with native scp and optionally set remote mode',
  },
  {
    name: 'download',
    aliases: [],
    usage: 'vssh download <remote> <local>',
    kind: 'core',
    description: 'Copy a remote file or directory with native scp',
  },
  {
    name: 'doctor',
    aliases: ['status'],
    usage: 'vssh doctor [--json]',
    kind: 'core',
    description: 'Verify OpenSSH, configuration, identity, and connectivity',
  },
  {
    name: 'config',
    aliases: ['--setup'],
    usage: 'vssh config <show|setup> [--json]',
    kind: 'core',
    description: 'Show non-secret effective configuration or configure the default target',
  },
  {
    name: 'commands',
    aliases: [],
    usage: 'vssh commands [--json]',
    kind: 'core',
    description: 'List the CLI surface and machine-readable metadata',
  },
  {
    name: 'local-mode',
    aliases: ['lm'],
    usage: 'vssh lm [on|off|status]',
    kind: 'compatibility',
    description: 'Manage the local-shell migration mode',
  },
  {
    name: 'dls',
    aliases: [],
    usage: 'vssh dls',
    kind: 'compatibility',
    description: 'List Docker containers',
  },
  {
    name: 'gdc',
    aliases: [],
    usage: 'vssh gdc <container-name-or-id> [--starts-with|--ends-with] [--return-name]',
    kind: 'compatibility',
    description: 'Resolve one Docker container ID or name',
  },
  {
    name: 'sdl',
    aliases: [],
    usage: 'vssh sdl <container> [docker-logs-options...]',
    kind: 'compatibility',
    description: 'Stream Docker logs',
  },
  {
    name: 'ldp',
    aliases: [],
    usage: 'vssh ldp',
    kind: 'compatibility',
    description: 'List Docker port mappings',
  },
  {
    name: 'ldn',
    aliases: [],
    usage: 'vssh ldn',
    kind: 'compatibility',
    description: 'List Docker networks',
  },
  {
    name: 'sdi',
    aliases: [],
    usage: 'vssh sdi',
    kind: 'compatibility',
    description: 'Show Docker system information',
  },
  {
    name: 'lcd',
    aliases: ['ldc'],
    usage: 'vssh lcd [config-name]',
    kind: 'compatibility',
    description: 'List or view Coolify dynamic configuration',
  },
  {
    name: 'vdc',
    aliases: [],
    usage: 'vssh vdc <config-name>',
    kind: 'compatibility',
    description: 'View one Coolify dynamic configuration file',
  },
  {
    name: 'udc',
    aliases: [],
    usage: 'vssh udc <local-yaml> [--name <config-name>]',
    kind: 'compatibility',
    description: 'Upload one Coolify dynamic configuration file',
  },
  {
    name: 'gcp',
    aliases: [],
    usage: 'vssh gcp',
    kind: 'compatibility',
    description: 'Show the Coolify proxy compose file',
  },
  {
    name: 'ef',
    aliases: ['edit-file'],
    usage: 'vssh ef <path> [edit-options...]',
    kind: 'compatibility',
    description: 'Apply targeted file edits with backup and dry-run support',
  },
] as const;

function showHelp(): void {
  console.log(`VSSH ${VERSION} — guarded remote execution through native OpenSSH

Usage:
  vssh [options] <command...>
  vssh [options] -c '<command>'
  vssh upload [--mode <octal>] <local> <remote>
  vssh download <remote> <local>
  vssh doctor

Core options:
  --json                 Capture and return one JSON result
  --timeout <seconds>    Stop the command after a deadline (exit 124)
  --tty, -t              Request a remote pseudo-terminal
  --host <host>          Override the configured host
  --user <user>          Override the configured user
  --identity, -i <path>  Override the private key
  --port, -p <port>      Override the SSH port
  --no-audit             Do not write bounded command metadata
  --local                Compatibility: run through the local shell
  --                      Treat the remaining arguments as a raw command

Examples:
  vssh 'docker ps --format "table {{.Names}}\\t{{.Status}}"'
  vssh --json 'systemctl is-active nginx'
  printf 'uptime\n' | vssh 'bash -s'
  vssh --timeout 30 'journalctl -u api --since "10 minutes ago"'
  vssh upload ./release.tar.gz /tmp/release.tar.gz

Discovery:
  vssh commands
  vssh commands --json
  vssh config show
  vssh --setup

VSSH guardrails catch common catastrophic commands; they are not a sandbox.`);
}

function parsePositiveNumber(value: string | undefined, option: string): number {
  const parsed = Number(value);
  if (!value || !Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${option} requires a positive number`);
  }
  return parsed;
}

function parseGlobalOptions(argv: string[]): ParsedGlobalOptions {
  const remaining = [...argv];
  const args: string[] = [];
  const overrides: ConfigOverrides = {};
  let json = false;
  let tty = false;
  let timeoutMs: number | undefined;
  let local: boolean | undefined;
  let noAudit = false;
  let literalCommand = false;
  let forceRaw = false;

  for (let index = 0; index < remaining.length; index++) {
    const current = remaining[index];
    if (current === '--') {
      args.push(...remaining.slice(index + 1));
      forceRaw = true;
      break;
    }
    if (current === '--json') { json = true; continue; }
    if (current === '--tty' || current === '-t') { tty = true; continue; }
    if (current === '--no-audit') { noAudit = true; continue; }
    if (current === '--local') { local = true; continue; }
    if (current === '--remote') { local = false; continue; }
    if (current === '--timeout') {
      timeoutMs = parsePositiveNumber(remaining[++index], '--timeout') * 1_000;
      continue;
    }
    if (current === '--host') {
      const value = remaining[++index];
      if (!value) throw new Error('--host requires a value');
      overrides.host = value;
      continue;
    }
    if (current === '--user') {
      const value = remaining[++index];
      if (!value) throw new Error('--user requires a value');
      overrides.user = value;
      continue;
    }
    if (current === '--identity' || current === '-i') {
      const value = remaining[++index];
      if (!value) throw new Error(`${current} requires a value`);
      overrides.keyPath = value;
      continue;
    }
    if (current === '--port' || current === '-p') {
      overrides.port = parsePositiveNumber(remaining[++index], current);
      continue;
    }
    if (current === '--command' || current === '-c') {
      const command = remaining[++index];
      if (!command) throw new Error(`${current} requires a command string`);
      args.push(command);
      literalCommand = true;
      forceRaw = true;
      break;
    }

    args.push(...remaining.slice(index));
    break;
  }

  // Metadata commands conventionally accept --json after the command name.
  if (['commands', 'doctor', 'status'].includes(args[0]) && args.includes('--json')) {
    json = true;
    args.splice(args.indexOf('--json'), 1);
  }
  if (args[0] === 'config' && args.includes('--json')) {
    json = true;
    args.splice(args.indexOf('--json'), 1);
  }

  return { args, json, tty, timeoutMs, local, noAudit, literalCommand, forceRaw, overrides };
}

function requireConfig(overrides: ConfigOverrides): Config {
  const loaded = loadConfig();
  if (!loaded && !overrides.host) {
    throw new Error('No SSH target configured. Run `vssh --setup` or pass --host.');
  }
  const base = loaded ?? { host: overrides.host! };
  return applyConfigOverrides(base, overrides);
}

function parseUploadArguments(args: string[]): { localPath: string; remotePath: string; mode?: number } {
  const positional: string[] = [];
  let mode: number | undefined;

  for (let index = 0; index < args.length; index++) {
    if (args[index].startsWith('--mode=')) {
      const value = args[index].slice('--mode='.length);
      if (!/^[0-7]{3,4}$/.test(value)) {
        throw new Error('--mode requires a 3- or 4-digit octal value');
      }
      mode = Number.parseInt(value, 8);
      continue;
    }
    if (args[index] !== '--mode') {
      positional.push(args[index]);
      continue;
    }
    const value = args[++index];
    if (!value || !/^[0-7]{3,4}$/.test(value)) {
      throw new Error('--mode requires a 3- or 4-digit octal value');
    }
    mode = Number.parseInt(value, 8);
  }

  if (positional.length !== 2) {
    throw new Error('Usage: vssh upload [--mode <octal>] <local> <remote>');
  }
  return { localPath: positional[0], remotePath: positional[1], ...(mode !== undefined && { mode }) };
}

function outputResult(
  result: CommandResult,
  transport: 'ssh' | 'local' | 'scp',
  json: boolean,
  warnings: string[] = []
): void {
  if (!json) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return;
  }
  process.stdout.write(`${JSON.stringify({
    success: result.exitCode === 0,
    command: result.command,
    transport,
    exitCode: result.exitCode,
    ...(result.signal && { signal: result.signal }),
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(warnings.length > 0 && { warnings }),
  })}\n`);
}

function audit(
  result: CommandResult,
  transport: 'ssh' | 'local' | 'scp',
  disabled: boolean,
  blocked = false
): void {
  if (disabled) return;
  try {
    writeAuditEvent({
      command: result.command,
      transport,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      blocked,
      timedOut: result.timedOut,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`VSSH audit warning: ${message}\n`);
  }
}

async function doctor(config: Config, json: boolean): Promise<number> {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
  const sshVersion = spawnSync('ssh', ['-V'], { encoding: 'utf8' });
  checks.push({
    name: 'ssh',
    ok: sshVersion.status === 0,
    detail: (sshVersion.stderr || sshVersion.stdout || 'OpenSSH not found').trim(),
  });
  const scpVersion = spawnSync('scp', ['-V'], { encoding: 'utf8' });
  checks.push({
    name: 'scp',
    ok: scpVersion.status === 0 || /usage:/i.test(scpVersion.stderr),
    detail: scpVersion.status === 0 || /usage:/i.test(scpVersion.stderr) ? 'available' : 'not found',
  });
  checks.push({ name: 'config', ok: true, detail: `${config.user ? `${config.user}@` : ''}${config.host}` });

  if (config.keyPath) {
    checks.push({
      name: 'identity',
      ok: fs.existsSync(config.keyPath),
      detail: fs.existsSync(config.keyPath) ? config.keyPath : `missing: ${config.keyPath}`,
    });
  } else {
    checks.push({ name: 'identity', ok: true, detail: 'ssh-agent or OpenSSH config' });
  }

  if (checks.every((check) => check.ok)) {
    try {
      const connected = await new SSHService(config).run('true', { mode: 'capture', timeoutMs: 10_000 });
      checks.push({
        name: 'connection',
        ok: connected.exitCode === 0,
        detail: connected.exitCode === 0 ? `${connected.durationMs}ms` : connected.stderr.trim() || `exit ${connected.exitCode}`,
      });
    } catch (error) {
      checks.push({
        name: 'connection',
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (json) {
    process.stdout.write(`${JSON.stringify({ success: checks.every((check) => check.ok), checks })}\n`);
  } else {
    console.log(`VSSH ${VERSION} doctor`);
    for (const check of checks) console.log(`${check.ok ? 'ok' : 'fail'}  ${check.name.padEnd(12)} ${check.detail}`);
  }
  return checks.every((check) => check.ok) ? 0 : 1;
}

async function main(): Promise<void> {
  const parsed = parseGlobalOptions(process.argv.slice(2));
  errorOutputJson = parsed.json;
  const [name, ...commandArguments] = parsed.args;

  if (!name || name === '--help' || name === '-h' || name === 'help') {
    showHelp();
    return;
  }
  if (name === '--version' || name === '-V' || name === 'version') {
    console.log(VERSION);
    return;
  }
  if (name === '--setup' || (name === 'config' && commandArguments[0] === 'setup')) {
    await setupInteractiveConfig();
    return;
  }
  if (name === 'commands' && !parsed.forceRaw) {
    if (parsed.json) {
      process.stdout.write(`${JSON.stringify({
        schemaVersion: 1,
        version: VERSION,
        defaultCommand: 'exec',
        globalOptions: GLOBAL_OPTIONS,
        commands: COMMANDS,
      })}\n`);
    } else {
      COMMANDS.forEach((command) => console.log(`${command.usage.padEnd(72)} ${command.description}`));
    }
    return;
  }

  const config = requireConfig(parsed.overrides);
  const local = parsed.local ?? config.localMode ?? false;
  const ssh = new SSHService(config);
  const mode: OutputMode = parsed.json ? 'capture' : 'inherit';

  if (name === 'config' && commandArguments[0] === 'show' && !parsed.forceRaw) {
    const shown = sanitizedConfig(config);
    if (parsed.json) process.stdout.write(`${JSON.stringify(shown)}\n`);
    else console.log(JSON.stringify(shown, null, 2));
    return;
  }
  if ((name === 'doctor' || name === 'status') && !parsed.forceRaw) {
    process.exitCode = await doctor(config, parsed.json);
    return;
  }
  if ((name === 'lm' || name === 'local-mode') && !parsed.forceRaw) {
    const action = commandArguments[0] ?? 'status';
    if (action === 'status') {
      const text = `Local compatibility mode is ${config.localMode ? 'enabled' : 'disabled'}.`;
      if (parsed.json) process.stdout.write(`${JSON.stringify({ enabled: config.localMode ?? false })}\n`);
      else console.log(text);
      return;
    }
    if (!['on', 'enable', 'off', 'disable'].includes(action)) {
      throw new Error('Usage: vssh lm [on|off|status]');
    }
    config.localMode = action === 'on' || action === 'enable';
    saveConfig(config);
    console.log(`Local compatibility mode ${config.localMode ? 'enabled' : 'disabled'}.`);
    return;
  }

  if ((name === 'upload' || name === 'download') && !parsed.forceRaw) {
    let result: CommandResult;
    if (name === 'upload') {
      const upload = parseUploadArguments(commandArguments);
      result = await ssh.upload(upload.localPath, upload.remotePath, {
        mode,
        timeoutMs: parsed.timeoutMs,
        ...(upload.mode !== undefined && { remoteMode: upload.mode }),
      });
    } else {
      if (commandArguments.length !== 2) {
        throw new Error('Usage: vssh download <remote> <local>');
      }
      result = await ssh.download(commandArguments[0], commandArguments[1], {
        mode,
        timeoutMs: parsed.timeoutMs,
      });
    }
    outputResult(result, 'scp', parsed.json);
    audit(result, 'scp', parsed.noAudit);
    process.exitCode = result.exitCode;
    return;
  }

  if (!parsed.forceRaw) {
    const compatibility = await runCompatibilityCommand(name, commandArguments, ssh, {
      mode,
      timeoutMs: parsed.timeoutMs,
      tty: parsed.tty,
      local,
    });
    if (compatibility) {
      outputResult(compatibility.result, compatibility.transport, parsed.json);
      audit(compatibility.result, compatibility.transport, parsed.noAudit);
      process.exitCode = compatibility.result.exitCode;
      return;
    }
  }

  const legacyRaw = !parsed.forceRaw && ['proxy', 'run', 'exec'].includes(name);
  if (legacyRaw && commandArguments.length === 0) {
    throw new Error(`Usage: vssh ${name} <command>`);
  }
  const rawArgs = legacyRaw
    ? commandArguments
    : parsed.forceRaw && !parsed.literalCommand
      ? parsed.args
      : [name, ...commandArguments];
  const command = commandFromArgs(rawArgs, parsed.literalCommand);
  const guard = new CommandGuardService().checkCommand(command);
  if (guard.isBlocked) {
    const blocked: CommandResult = {
      command,
      stdout: '',
      stderr: `Command blocked: ${guard.reasons.join('; ')}\n`,
      exitCode: 126,
      durationMs: 0,
      timedOut: false,
    };
    if (parsed.json) outputResult(blocked, local ? 'local' : 'ssh', true);
    else process.stderr.write(blocked.stderr);
    audit(blocked, local ? 'local' : 'ssh', parsed.noAudit, true);
    process.exitCode = blocked.exitCode;
    return;
  }

  if (!parsed.json) {
    for (const warning of guard.reasons) process.stderr.write(`VSSH ${warning}\n`);
  }
  const result = local
    ? await ssh.runLocal(command, { mode, timeoutMs: parsed.timeoutMs, forwardStdin: true })
    : await ssh.run(command, {
        mode,
        timeoutMs: parsed.timeoutMs,
        tty: parsed.tty,
        forwardStdin: true,
      });
  outputResult(result, local ? 'local' : 'ssh', parsed.json, guard.reasons);
  audit(result, local ? 'local' : 'ssh', parsed.noAudit);
  process.exitCode = result.exitCode;
}

let errorOutputJson = process.argv[2] === '--json';

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (errorOutputJson) process.stdout.write(`${JSON.stringify({ success: false, error: message, exitCode: 1 })}\n`);
  else process.stderr.write(`vssh: ${message}\n`);
  process.exitCode = 1;
});

import * as fs from 'fs';
import * as path from 'path';
import type { CommandResult, OutputMode } from './services/ssh';
import { SSHService } from './services/ssh';
import { shellQuote } from './shell';
import { runEditCommand } from './edit-file';

export interface CompatibilityOptions {
  mode: OutputMode;
  timeoutMs?: number;
  tty?: boolean;
  local: boolean;
}

export interface CompatibilityExecution {
  result: CommandResult;
  transport: 'ssh' | 'local' | 'scp';
}

function synthetic(command: string, stdout = '', stderr = '', exitCode = 0): CommandResult {
  return { command, stdout, stderr, exitCode, durationMs: 0, timedOut: false };
}

function flagValue(args: string[], names: string[]): string | undefined {
  for (let index = 0; index < args.length; index++) {
    if (names.includes(args[index])) return args[index + 1];
  }
  return undefined;
}

function hasFlag(args: string[], names: string[]): boolean {
  return args.some((arg) => names.includes(arg));
}

function withoutFlags(args: string[], namesWithValues: string[], booleanNames: string[]): string[] {
  const output: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (namesWithValues.includes(args[index])) {
      index++;
      continue;
    }
    if (booleanNames.includes(args[index])) continue;
    output.push(args[index]);
  }
  return output;
}

async function findCoolifyConfig(ssh: SSHService, query: string, timeoutMs?: number): Promise<CommandResult> {
  const listed = await ssh.run(
    "find /data/coolify/proxy/dynamic -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' -o -name '*.toml' -o -name '*.json' \\) -print 2>/dev/null | sort",
    { mode: 'capture', timeoutMs }
  );
  if (listed.exitCode !== 0) return listed;

  const files = listed.stdout.split('\n').filter(Boolean);
  const normalized = query.replace(/\.(?:ya?ml|toml|json)$/i, '');
  const exact = files.find((file) => path.basename(file).replace(/\.(?:ya?ml|toml|json)$/i, '') === normalized);
  const fuzzy = files.filter((file) => path.basename(file).toLowerCase().includes(normalized.toLowerCase()));

  if (!exact && fuzzy.length !== 1) {
    const detail = fuzzy.length > 1
      ? `Multiple configs match ${query}:\n${fuzzy.map((file) => `  ${path.basename(file)}`).join('\n')}\n`
      : `No Coolify config matches ${query}.\n`;
    return synthetic(`vdc ${query}`, '', detail, 1);
  }

  return ssh.run(`cat -- ${shellQuote(exact ?? fuzzy[0])}`, { mode: 'capture', timeoutMs });
}

export async function runCompatibilityCommand(
  name: string,
  args: string[],
  ssh: SSHService,
  options: CompatibilityOptions
): Promise<CompatibilityExecution | null> {
  const run = (command: string, forceCapture = false) => options.local
    ? ssh.runLocal(command, {
        mode: forceCapture ? 'capture' : options.mode,
        timeoutMs: options.timeoutMs,
      })
    : ssh.run(command, {
        mode: forceCapture ? 'capture' : options.mode,
        timeoutMs: options.timeoutMs,
        tty: options.tty,
      });
  const transport = options.local ? 'local' as const : 'ssh' as const;

  const direct: Record<string, string> = {
    dls: "docker ps -a --format 'table {{.ID}}\\t{{.Names}}\\t{{.Status}}'",
    ldp: "docker ps -a --format 'table {{.Names}}\\t{{.Ports}}'",
    ldn: 'docker network ls',
    sdi: 'docker info',
    gcp: 'cat -- /data/coolify/proxy/docker-compose.yml',
  };
  if (direct[name]) return { result: await run(direct[name]), transport };

  if (name === 'sdl') {
    if (args.length === 0) return { result: synthetic('sdl', '', 'Usage: vssh sdl <container> [docker logs options]\n', 2), transport };
    return { result: await run(`docker logs ${args.map(shellQuote).join(' ')}`), transport };
  }

  if (name === 'gdc') {
    const positional = withoutFlags(
      args,
      [],
      ['--startsWith', '--starts-with', '--endsWith', '--ends-with', '--returnName', '--return-name']
    );
    const query = positional[0];
    if (!query) return { result: synthetic('gdc', '', 'Usage: vssh gdc <container-name-or-id>\n', 2), transport };

    const listed = await run("docker ps -a --format '{{json .}}'", true);
    if (listed.exitCode !== 0) return { result: listed, transport };

    const containers = listed.stdout.split('\n').filter(Boolean).flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as { ID?: string; Names?: string };
        return parsed.ID && parsed.Names ? [parsed] : [];
      } catch {
        return [];
      }
    });
    const needle = query.toLowerCase();
    const matches = containers.filter((container) => {
      const values = [container.ID!, container.Names!].map((value) => value.toLowerCase());
      if (hasFlag(args, ['--startsWith', '--starts-with'])) return values.some((value) => value.startsWith(needle));
      if (hasFlag(args, ['--endsWith', '--ends-with'])) return values.some((value) => value.endsWith(needle));
      return values.some((value) => value.includes(needle));
    });

    const output = matches.length === 1
      ? `${hasFlag(args, ['--returnName', '--return-name']) ? matches[0].Names : matches[0].ID}\n`
      : '';
    const error = matches.length === 0
      ? `No container matches ${query}.\n`
      : matches.length > 1
        ? `Multiple containers match ${query}: ${matches.map((item) => item.Names).join(', ')}\n`
        : '';
    const result = synthetic(`gdc ${query}`, output, error, matches.length === 1 ? 0 : 1);
    return { result, transport };
  }

  if (name === 'lcd' || name === 'ldc') {
    if (args[0]) {
      const result = await findCoolifyConfig(ssh, args[0], options.timeoutMs);
      return { result, transport: 'ssh' };
    }
    const listed = await ssh.run(
      "find /data/coolify/proxy/dynamic -maxdepth 1 -type f \\( -name '*.yml' -o -name '*.yaml' -o -name '*.toml' -o -name '*.json' \\) -print 2>/dev/null | sort",
      { mode: 'capture', timeoutMs: options.timeoutMs }
    );
    if (listed.exitCode === 0) {
      listed.stdout = listed.stdout.split('\n').filter(Boolean).map((file) => path.basename(file)).join('\n');
      if (listed.stdout) listed.stdout += '\n';
    }
    return { result: listed, transport: 'ssh' };
  }

  if (name === 'vdc') {
    if (!args[0]) return { result: synthetic('vdc', '', 'Usage: vssh vdc <config-name>\n', 2), transport: 'ssh' };
    const result = await findCoolifyConfig(ssh, args[0], options.timeoutMs);
    return { result, transport: 'ssh' };
  }

  if (name === 'udc') {
    const localPath = args[0];
    if (!localPath) return { result: synthetic('udc', '', 'Usage: vssh udc <local-yaml> [--name <config-name>]\n', 2), transport: 'scp' };
    const absolutePath = path.resolve(localPath);
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      return { result: synthetic(`udc ${localPath}`, '', `File not found: ${absolutePath}\n`, 2), transport: 'scp' };
    }
    const requestedName = flagValue(args.slice(1), ['--name']);
    const base = requestedName ?? path.basename(absolutePath);
    const remoteName = /\.ya?ml$/i.test(base) ? base : `${base}.yaml`;
    if (!/^[A-Za-z0-9._-]+$/.test(remoteName)) {
      return { result: synthetic(`udc ${localPath}`, '', 'Config name may contain only letters, numbers, dot, underscore, and dash.\n', 2), transport: 'scp' };
    }
    const result = await ssh.upload(absolutePath, `/data/coolify/proxy/dynamic/${remoteName}`, {
      mode: options.mode,
      timeoutMs: options.timeoutMs,
      recursive: false,
    });
    return { result, transport: 'scp' };
  }

  if (name === 'ef' || name === 'edit-file') {
    const result = await runEditCommand(ssh, args, options);
    return { result, transport: options.local ? 'local' : 'ssh' };
  }

  if (['plugins', 'plugin', 'install', 'lgd', 'vgd'].includes(name)) {
    const message = name === 'lgd' || name === 'vgd'
      ? `${name} was removed in VSSH 2; use raw Docker/Grafana API commands through vssh.\n`
      : `${name} was removed in VSSH 2; VSSH is now a focused CLI without MCP or a plugin runtime.\n`;
    const result = synthetic(name, '', message, 2);
    return { result, transport };
  }

  return null;
}

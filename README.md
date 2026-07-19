# VSSH

**VSSH turns native OpenSSH into a predictable automation contract.**

OpenSSH already solves secure remote access. VSSH keeps its transport,
authentication, host verification, configuration, and command language intact,
then adds the operational guarantees that scripts and agents otherwise have to
rebuild around every `ssh` and `scp` call.

## SSH and VSSH

| Capability | SSH / SCP | VSSH |
|---|---|---|
| Secure transport | Native OpenSSH authentication, encryption, host verification, `known_hosts`, and SSH-agent behavior | Uses that same native OpenSSH path; VSSH does not replace or emulate SSH |
| Remote commands | Runs familiar shell, Linux, Docker, and systemd commands | Runs the same commands with no VSSH-specific remote language |
| Target selection | Repeat connection flags or maintain an OpenSSH host alias | Save one default target, then override host, user, identity, or port per call |
| Terminal behavior | Streams stdin, stdout, and stderr; supports TTYs and returns the remote exit code | Preserves streaming, stdin, TTY, signals, and the remote exit code in raw mode |
| Automation output | Build and maintain wrappers to separate streams, time execution, detect timeout, and serialize a result | `--json` emits one bounded object with stdout, stderr, exit code, duration, timeout state, and signal when applicable |
| Catastrophic-command guardrails | Sends the command as written | Blocks recognizable root deletion, direct disk writes, destructive volume cleanup, firewall flushes, and shutdown patterns before connecting |
| File transfer with permissions | Coordinate `scp` with a separate `ssh chmod` call and reconcile failures | `upload --mode <octal>` performs both as one reported operation and fails if either phase fails |
| Connection diagnosis | Check binaries, configuration, identity, and reachability separately | `vssh doctor` verifies the complete path, including a real connection |
| Audit trail | Add shell history or custom logging, often capturing sensitive command content | Writes owner-only outcome metadata and a command hash; never command text, output, credentials, or file contents |
| Repeated-call latency | Configure OpenSSH multiplexing yourself | Reuses a short-lived OpenSSH control connection when possible |
| Agent discovery | Parse help text and infer aliases or argument shapes | `commands --json` exposes a versioned, machine-readable command contract |

That is the product boundary: familiar SSH security and commands underneath; a
consistent remote-operations contract above them.

If you know SSH, you already know the command model:

```bash
# OpenSSH
ssh deploy@prod 'systemctl is-active api'

# VSSH after one-time setup
vssh 'systemctl is-active api'
```

The quoted text is not a VSSH-specific language. It is the same remote shell
command you would give to `ssh`: Linux, Docker, systemd, and shell commands all
remain unchanged.

Use plain `ssh` for an interactive session or an isolated one-off. Use VSSH when
a script or agent needs to repeat remote work with predictable results,
diagnostics, transfers, guardrails, and privacy-safe evidence. The guardrails
are not a sandbox or authorization boundary.

## Quick start

```bash
npm install -g @light-merlin-dark/vssh
vssh --setup       # save the host, user, identity, and port
vssh doctor        # verify the complete connection path

vssh uptime       # run uptime on the configured remote host
vssh --json 'systemctl is-active api'
vssh upload --mode 600 ./app.env /etc/app/app.env
```

Configuration is stored at `~/.vssh/config.json` with owner-only permissions.

## The four operations to remember

```bash
vssh '<remote command>'                  # run through native ssh
vssh --json '<remote command>'           # capture one structured result
vssh upload <local> <remote>             # send through native scp
vssh download <remote> <local>           # retrieve through native scp
vssh doctor                              # diagnose setup and connectivity
```

`docker`, `systemctl`, `journalctl`, `find`, and similar names in the examples
below are programs on the remote machine—not VSSH subcommands.

## Requirements

- macOS or Linux
- Node.js 18 or newer
- OpenSSH `ssh` and `scp`
- Key-based access, an `ssh-agent`, or a working OpenSSH host alias

Windows is not currently supported.

## If setup or a command fails

Start with `vssh doctor` for a readable diagnosis or `vssh doctor --json` for
automation. It checks that `ssh` and `scp` exist, the configuration and identity
path are usable, and the target accepts a real connection.

VSSH preserves native failure behavior instead of hiding it:

- Host-key, authentication, DNS, and connection errors remain normal OpenSSH
  errors.
- A failed remote command exits with the remote status. In JSON mode, the same
  failure still produces one parseable object with `success: false`, `exitCode`,
  `stdout`, and `stderr`.
- A timeout exits with status 124 and sets `timedOut: true` in JSON mode.
- Captured output over 16 MiB fails rather than returning silently truncated
  JSON; use raw mode for large streams.

## Run commands

Pass one quoted shell command when it contains pipes, redirects, variables, or other shell syntax:

```bash
vssh uptime
vssh 'df -h / && free -h'
vssh 'docker ps --format "{{.Names}}\t{{.Status}}"'
vssh -c 'journalctl -u api --since "10 minutes ago" | tail -100'
```

Multiple ordinary arguments are shell-quoted before execution:

```bash
vssh printf %s 'hello world'
```

Use `--` if a command name conflicts with a VSSH command:

```bash
vssh -- commands
```

### Streaming and stdin

Raw mode is the default. It connects the remote process directly to the terminal or pipeline:

```bash
printf 'uptime\n' | vssh 'bash -s'
vssh 'docker logs -f api --tail 50'
vssh --tty 'sudo systemctl status api'
```

VSSH returns the remote process exit code. A timed-out command returns `124`.

### JSON mode

`--json` captures output and writes exactly one JSON object:

```bash
vssh --json --timeout 30 'systemctl is-active api'
```

```json
{
  "success": true,
  "command": "systemctl is-active api",
  "transport": "ssh",
  "exitCode": 0,
  "durationMs": 84,
  "timedOut": false,
  "stdout": "active\n",
  "stderr": ""
}
```

JSON mode is bounded to 16 MiB of captured output. If the combined captured
output exceeds that limit, the command fails instead of returning a truncated
result. Use raw mode for large or unbounded streams.

## Transfer files

Uploads and downloads use native `scp`. Directories work recursively without an archive staging step.

```bash
vssh upload ./config.yml /etc/app/config.yml
vssh upload --mode 600 ./app.env /etc/app/app.env
vssh upload ./build /var/www/
vssh download /var/log/app.log ./logs/app.log
vssh download /var/www/site ./site-copy
```

The same SSH control connection is reused when possible, which substantially reduces repeated command and transfer startup cost.

`upload --mode <octal>` sets permissions after a successful copy and fails the operation if `chmod` fails. This replaces fragile upload-then-chmod scripting while still using the reused OpenSSH connection.

## Connection options

Override the default target without editing configuration:

```bash
vssh --host staging.example.com --user deploy uptime
vssh --host prod --identity ~/.ssh/prod_ed25519 --port 2222 uptime
```

Environment variables are also supported:

- `VSSH_HOST` (or legacy `SSH_HOST`)
- `VSSH_USER`
- `VSSH_KEY_PATH`
- `VSSH_PORT`
- `VSSH_HOME` and `VSSH_CONFIG_PATH` for isolated environments

For example, override the saved target for one command without changing the
configuration file:

```bash
VSSH_HOST=staging.example.com VSSH_USER=deploy vssh uptime
```

Example configuration:

```json
{
  "host": "prod",
  "user": "deploy",
  "keyPath": "/Users/you/.ssh/id_ed25519",
  "port": 22,
  "connectTimeoutSeconds": 30,
  "controlPersistSeconds": 60,
  "localMode": false
}
```

The host may be an OpenSSH alias. If `user` or `keyPath` is omitted, OpenSSH resolves it from the SSH agent and normal configuration files.

## Safety and audit behavior

VSSH blocks recognizable forms of a small set of catastrophic operations, including broad root deletion, direct disk formatting/writes, destructive Docker volume pruning, firewall flushing, and shutdown commands. Suspicious download-and-execute pipelines produce warnings.

The exact current patterns live in
[`command-guard.ts`](src/services/command-guard.ts). They are deliberately
narrow and are not user-customizable.

These checks are guardrails, not a shell parser, policy engine, authorization boundary, or sandbox. Review commands with the same care you would use with `ssh`.

Audit records are JSON Lines at `~/.vssh/data/logs/commands.jsonl`. Each record contains timestamp, transport, duration, exit status, command byte length, and a SHA-256 command hash. Command text and command output are never logged. Use `--no-audit` when even metadata should not be recorded.

## Discovery and diagnostics

```bash
vssh --version
vssh commands
vssh commands --json
vssh config show
vssh config show --json
vssh doctor
vssh doctor --json
```

`config show` is intentionally non-secret. `doctor` verifies the local OpenSSH tools, identity path, and an actual connection.

`commands --json` is a versioned discovery contract. It returns a schema version, the CLI version, the implicit default command, global options, and one record per invocable command with an exact name, aliases, usage, kind, and description. Agents do not need to scrape help text or split comma-delimited shortcuts.

## VSSH 1 compatibility commands

VSSH 2 keeps a small compatibility boundary for command names that still exist in deployed scripts:

- Docker: `dls`, `gdc`, `sdl`, `ldp`, `ldn`, `sdi`
- Coolify dynamic config: `lcd`/`ldc`, `vdc`, `udc`, `gcp`
- Targeted file editing: `ef` / `edit-file`
- Local-mode migration: `lm` / `local-mode`

They are not plugins and are not the primary product surface. New scripts should prefer raw, familiar remote commands:

```bash
vssh "docker ps -a"
vssh "docker logs api --tail 100"
vssh "find /data/coolify/proxy/dynamic -maxdepth 1 -type f"
```

The VSSH 1 MCP server, MCP installer, general plugin runtime, Grafana discovery commands, credential encryption subsystem, and usage-promoted help were removed in VSSH 2. They added substantial maintenance and security surface without enough independent value over the CLI.

## Development

```bash
git clone https://github.com/light-merlin-dark/vssh.git
cd vssh
bun install
bun run dev --help
npm run verify
npm pack --dry-run
```

Publishing uses npm so end users need only Node.js, not Bun.

## License

MIT — see [LICENSE](LICENSE).

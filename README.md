# VSSH

## SSH is the transport. VSSH is the operating contract around it.

OpenSSH is already excellent at secure remote execution. VSSH keeps it intact and adds the pieces agents and automation otherwise have to rebuild in every project: preflight guardrails, structured results, privacy-safe audit metadata, repeatable diagnostics, and file transfer with permission setting.

VSSH does not introduce a second remote command language. The command after `vssh` is still the Linux, Docker, systemd, or shell command you already know.

### What VSSH adds to normal SSH

| Need | Plain `ssh` / `scp` | VSSH |
|---|---|---|
| Agent-readable results | You write parsing and error wrappers | One stable `--json` result with separate stdout, stderr, exit code, timing, signal, and timeout state |
| Catastrophic-command checks | The command is sent as written | Recognizable root deletion, disk writes, destructive volume cleanup, firewall flushes, and shutdown commands are blocked before connection |
| Operational audit trail | Add shell history or logging yourself | Owner-only metadata with command hash and outcome; command text and output are never stored |
| Upload plus permissions | Coordinate `scp` and a second `ssh chmod` call | `upload --mode <octal>` is one operation and fails if either phase fails |
| Connection readiness | Diagnose binaries, key paths, config, and reachability separately | `vssh doctor` checks the complete path, including a real connection |
| Repeated-call latency | Configure multiplexing yourself | Short-lived OpenSSH control reuse is enabled by default |

Underneath, VSSH delegates transport, host verification, `known_hosts`, SSH-agent access, streaming, signals, and remote exit behavior to your native OpenSSH client.

## Thirty-second start

```bash
npm install -g @light-merlin-dark/vssh
vssh --setup
vssh doctor

vssh 'docker ps --format "table {{.Names}}\t{{.Status}}"'
vssh upload ./release.tar.gz /tmp/release.tar.gz
vssh --json 'systemctl is-active api'
```

That is the product boundary: native SSH behavior plus a small, dependable automation layer. VSSH is intentionally not an SSH protocol, MCP server, plugin platform, Docker wrapper, or production control plane.

## Requirements

- macOS or Linux
- Node.js 18 or newer
- OpenSSH `ssh` and `scp`
- Key-based access, an `ssh-agent`, or a working OpenSSH host alias

Configuration is stored at `~/.vssh/config.json` with owner-only permissions.

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

JSON mode is bounded to 16 MiB of captured output. Use raw mode for large or unbounded streams.

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

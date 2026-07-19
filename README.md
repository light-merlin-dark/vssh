# VSSH

**Native SSH underneath. Guardrails and predictable automation output on top.**

VSSH runs ordinary remote shell commands through the `ssh` already installed on
your machine and transfers files through `scp`. It adds a small layer for
scripts and agents: one default target, checks for a short list of catastrophic
commands, stable JSON results, connection diagnostics, private audit metadata,
and file transfers that can set permissions.

If you know SSH, you already know how to run commands with VSSH:

```bash
# OpenSSH
ssh deploy@prod 'systemctl is-active api'

# VSSH after one-time setup
vssh 'systemctl is-active api'
```

The quoted text is not a VSSH-specific language. It is the same remote shell
command you would give to `ssh`: Linux, Docker, systemd, and shell commands all
remain unchanged.

## When VSSH earns an install

Use plain `ssh` when you want an interactive shell or a one-off command and do
not need an automation contract.

Use VSSH when a script or agent repeatedly operates one remote target and you
want these behaviors without rebuilding them in every project:

- **One JSON result:** stdout, stderr, exit code, duration, timeout state, and a
  signal when applicable have a stable machine-readable shape.
- **Catastrophic-command checks:** recognizable root deletion, direct disk
  writes, destructive Docker volume cleanup, firewall flushes, and shutdown
  commands are blocked before a connection is opened.
- **Real diagnostics:** `vssh doctor` checks the local tools, configuration,
  identity path, and a live SSH connection.
- **Simple transfers:** `upload`, `upload --mode`, and `download` use native
  `scp`; permission setting can be part of the upload operation.
- **Private audit metadata:** VSSH records a command hash and outcome, never the
  command text, output, credentials, or file contents.
- **Faster repeated calls:** a short-lived OpenSSH control connection is reused
  when possible.

Underneath, VSSH delegates transport, host verification, `known_hosts`, SSH-agent access, streaming, signals, and remote exit behavior to your native OpenSSH client.

VSSH is not a replacement SSH protocol, a sandbox, an MCP server, a plugin
platform, or a Docker-specific wrapper.

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

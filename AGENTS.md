# VSSH Development Guide

## Product Contract

- Brand: `VSSH`
- Package and executable: `@light-merlin-dark/vssh` / `vssh`
- Product: a focused CLI for guarded remote execution and file transfer through native OpenSSH
- VSSH is not an SSH protocol, MCP server, plugin platform, Docker wrapper, or production control plane
- New functionality must earn its place in the core by being broadly reusable and materially better than a familiar raw SSH command
- Prefer purpose-built higher-level operator CLIs; VSSH is the low-level remote shell and evidence path

## Continuity

The active engineering handoff is `docs/plan.md`.

- Read it before starting work.
- Keep it aligned with ground truth as work changes.
- At session end, remove completed/stale detail and leave only actionable follow-up.

## Runtime Contract

VSSH 2 delegates transport to the local `ssh` and `scp` executables.

Non-negotiable behavior:

- Normal OpenSSH host verification and `known_hosts` policy remain intact.
- Raw mode streams stdin/stdout/stderr and propagates the remote exit code.
- JSON mode emits exactly one parseable result and is bounded in memory.
- Signals and timeouts propagate predictably.
- Repeated operations reuse an OpenSSH control connection when possible.
- Audit logs never contain command text, command output, credentials, or file contents.
- Safety checks are documented as guardrails, never a sandbox or authorization boundary.

## Supported Surface

Core:

- `vssh '<command>'`
- `vssh -c '<command>'`
- `vssh --json '<command>'`
- `vssh upload [--mode <octal>] <local> <remote>`
- `vssh download <remote> <local>`
- `vssh doctor`
- `vssh config show`
- `vssh commands --json`

Compatibility-only:

- Docker aliases: `dls`, `gdc`, `sdl`, `ldp`, `ldn`, `sdi`
- Coolify aliases: `lcd`/`ldc`, `vdc`, `udc`, `gcp`
- Remote edit: `ef` / `edit-file`
- Local-mode migration: `lm` / `local-mode`

Do not expand the compatibility layer or promote it in lead product copy. New examples should use familiar raw remote commands.

Removed in VSSH 2:

- `vssh-mcp` and MCP installation
- Dynamic plugin loading and plugin management
- Grafana discovery and encrypted plugin credentials
- Usage-promoted help

Reintroduction requires independent usage evidence and should normally be a separate package.

## Development

Bun is the development/test runner; npm is the publishing path.

```bash
bun install
bun run dev --help
npm run lint
npm test
npm run build
npm run smoke
npm run verify
npm pack --dry-run
```

Requirements:

- Node.js 18+
- macOS or Linux
- Native OpenSSH `ssh` and `scp`

## Project Structure

```text
src/
├── index.ts                    CLI parser and orchestration
├── config.ts                   Config migration, persistence, overrides
├── shell.ts                    POSIX argument reconstruction
├── compatibility.ts            Bounded VSSH 1 compatibility commands
├── edit-file.ts                Compatibility file-edit workflow
├── services/
│   ├── ssh.ts                  Native ssh/scp process execution
│   ├── command-guard.ts        Catastrophic-command guardrails
│   ├── command-guard-service.ts
│   └── audit-log.ts            Content-free JSONL audit metadata
└── types/index.ts
```

## Testing Rules

- Integration tests use fake `ssh`/`scp` executables and must cover stream separation, stdin, exit codes, timeout, guard blocking, JSON shape, audit privacy, and transfer argv.
- Never make the ordinary test suite depend on a real server or the maintainer's `~/.vssh` state.
- Build before package inspection so removed source cannot survive as stale `dist` files.
- The local release gate must pass under the supported Node versions and production `npm audit` must be clean.

## Release Rules

- Keep `README.md`, `CHANGELOG.md`, CLI help, `commands --json`, package metadata, and the operator skill consistent.
- Run `npm run verify`, `npm audit --omit=dev`, and `npm pack --dry-run` before publishing.
- Do not add GitHub Actions for this project; release verification is intentionally local and explicit.
- Publishing uses npm; end users must not need Bun.
- The package must have zero runtime npm dependencies unless a future dependency demonstrably replaces more complexity than it adds.

## Public Site Contract

The public consumer lives at `/Users/merlin/_dev/vssh-public`.

When product positioning changes here, update its `AGENTS.md` in the same work. Homepage copy and structure remain intentionally controlled in the public app; do not auto-rewrite or deploy it as a side effect of CLI work.

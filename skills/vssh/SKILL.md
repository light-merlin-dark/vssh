---
name: vssh
description: Operate a configured SSH target through the VSSH CLI with native OpenSSH behavior, safety guardrails, structured output, and file transfer. Use for remote diagnostics, shell commands, production inspection, and uploads/downloads.
---

# VSSH

Use `vssh` as the default low-level SSH interface when the target is already configured. VSSH delegates transport, identity verification, agent access, streaming, and exit behavior to native OpenSSH.

## Start Here

```bash
vssh doctor
vssh 'hostname && uptime'
vssh 'nproc && free -h && df -h /'
vssh 'docker ps --format "table {{.Names}}\t{{.Status}}"'
```

If `doctor` fails, stop and surface the connection/configuration failure. Do not substitute a weaker production access path silently.

## Core Commands

Run remote commands:

```bash
vssh '<command>'
vssh -c '<command>'
vssh --json '<command>'
vssh --timeout 30 '<command>'
vssh --tty '<interactive-command>'
```

Transfer files or directories:

```bash
vssh upload [--mode <octal>] <local> <remote>
vssh download <remote> <local>
```

Inspect configuration and discover the surface:

```bash
vssh config show
vssh commands --json
vssh doctor --json
```

Override the target explicitly:

```bash
vssh --host <host> --user <user> --identity <key> --port <port> '<command>'
```

## Operating Rules

1. Prefer a read-only inspection before a mutation.
2. Use one quoted argument for pipes, redirects, variables, or multi-step shell expressions.
3. Use raw mode for streams and large output; use `--json` for bounded automation results.
4. Preserve and interpret the VSSH exit code. A remote failure is a failed operation; timeout is exit `124`; a guard block is exit `126`.
5. Verify every availability-impacting change immediately.
6. Treat safety checks as guardrails, not a sandbox or authorization boundary.
7. Never place credentials directly in command text when a file, environment injection, or purpose-built control plane is available.

## Familiar Commands First

Agents already know Linux, Docker, systemd, and common operational tools. Prefer those commands directly:

```bash
vssh 'docker ps -a'
vssh 'docker logs api --tail 100'
vssh 'systemctl status api --no-pager'
vssh 'journalctl -u api --since "15 minutes ago" | tail -200'
```

VSSH 1 aliases such as `dls`, `gdc`, `sdl`, `lcd`, `vdc`, `udc`, and `ef` remain only for existing scripts. Do not introduce them into new runbooks.

## Audit Behavior

VSSH records owner-only metadata at `~/.vssh/data/logs/commands.jsonl`: timestamp, transport, exit code, duration, command length, and command hash. It does not record command text or output. Use `--no-audit` when metadata should not be stored.

## Scope

VSSH is a CLI, not an MCP server or plugin platform. Use purpose-built higher-level CLIs before VSSH when they own the operation; use VSSH for low-level evidence and remote shell access those tools do not expose.

---
name: vssh-proxy
description: Use the core vssh proxy plugin for generic remote command execution and local-mode control. Prefer this when the task is raw shell execution rather than a higher-level plugin workflow.
---

# VSSH Proxy Plugin

Use this plugin when the task is fundamentally "run a command on the target host" or "toggle local mode".

## Primary Commands
- `vssh "<command>"`
- `vssh proxy "<command>"`
- `vssh run "<command>"`
- `vssh exec "<command>"`
- `vssh lm status`
- `vssh lm on`
- `vssh lm off`

## Workflow
1. Check execution mode with `vssh lm status`.
2. Prefer a read-only command first.
3. Use explicit quoting for pipes or compound shell.
4. Verify the result with a second command if the first was mutating.

## Examples
```bash
vssh lm status
vssh "hostname && uptime"
vssh 'ps aux | grep node'
vssh lm on
```

## Safety
- Do not bypass command guards.
- Prefer plugin-specific commands when Docker, file transfer, Coolify, Grafana, or file editing are clearly the real task.
- Treat `local-mode on` as a deliberate context switch and confirm before using it for destructive commands.

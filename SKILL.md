---
name: vssh
description: Operate Linux infrastructure through the vssh CLI with safer remote command execution, file transfer, Docker, Coolify, Grafana, and optional MCP exposure. Use when asked to run server commands, investigate production incidents, check CPU/memory/disk health, manage Docker containers, upload/download files, or update/view Coolify Traefik dynamic configs on a remote host.
---

# VSSH

Use `vssh` as the default CLI for SSH-driven infrastructure work.
Lead with the CLI surface. Treat MCP exposure as an optional extension when an agent needs tool access, not as the primary framing of the product.

## Core Workflow
1. Confirm access and execution mode.
2. Capture host health snapshot (CPU, memory, disk, load).
3. Run task-specific commands (generic shell, file transfer, Docker, Coolify, Grafana, or file editing).
4. Verify effect and summarize exactly what changed.

Use these commands in order when context is missing:

```bash
vssh lm status
vssh "hostname && uptime"
vssh "nproc && free -h && df -h /"
vssh dls
```

## Command Map
Run remote shell commands:
- `vssh "<command>"` (default remote execution)
- `vssh proxy "<command>"` (same intent, explicit proxy command)
- `vssh --json "<command>"` (machine-readable output)

Control local/remote mode:
- `vssh lm status`
- `vssh lm on`
- `vssh lm off`

Transfer files:
- `vssh upload <local> <remote>` (aliases: `push`, `put`)
- `vssh download <remote> <local>` (aliases: `pull`, `get`)
- Directory transfer auto-compresses/decompresses (`tar.gz`) on upload/download.

Inspect Docker:
- `vssh dls` list containers
- `vssh gdc <term>` find one container
- `vssh sdl <container> --tail 100` logs
- `vssh ldp` ports
- `vssh ldn` networks
- `vssh sdi` docker/system info

Manage Coolify dynamic proxy config:
- `vssh lcd` list config filenames (alias `ldc`)
- `vssh vdc <name>` view one config
- `vssh udc ./file.yaml [--name <config>]` upload/update dynamic config
- `vssh gcp` get Coolify proxy configuration

Inspect Grafana:
- `vssh lgd` list dashboards
- `vssh vgd <term>` view one dashboard by name, UID, or partial match

Edit files safely:
- `vssh ef <path> --search "old" --replace "new"`
- `vssh ef <path> --regex "pattern" --with "value" --flags "g"`
- `vssh ef <path> --dry-run ...` before risky edits

## Plugin Skills
Use plugin-local skills when the task is clearly scoped:
- [`proxy`](../../src/plugins/builtin/proxy/SKILL.md) for command execution and local-mode control
- [`file-transfer`](../../src/plugins/builtin/file-transfer/SKILL.md) for uploads/downloads
- [`docker`](../../src/plugins/builtin/docker/SKILL.md) for container inspection and logs
- [`coolify`](../../src/plugins/builtin/coolify/SKILL.md) for Traefik dynamic config work
- [`grafana`](../../src/plugins/builtin/grafana/SKILL.md) for dashboard discovery
- [`file-editor`](../../src/plugins/builtin/file-editor/SKILL.md) for targeted file mutations

## Coolify Change Procedure
1. Inspect current state:
```bash
vssh lcd
vssh vdc <target-config>
```

2. Prepare a local YAML change and upload:
```bash
vssh udc ./traefik-dynamic.yaml --name <target-config>
```

3. Verify:
```bash
vssh vdc <target-config>
vssh "docker ps --format 'table {{.Names}}\t{{.Status}}'"
```

## Production Context
Read [`references/production-baseline.md`](references/production-baseline.md) before making capacity-sensitive decisions.
Keep project- and domain-specific details out of routine summaries unless explicitly requested.

## Safety Rules
- Prefer read-only diagnostics before write operations.
- Avoid destructive shell operations on production paths.
- Respect command guard blocks; do not attempt bypass patterns.
- Use explicit command quoting for pipes/redirection (`vssh 'ps aux | grep ...'`).
- If a command can impact availability, state expected blast radius and verify immediately after execution.

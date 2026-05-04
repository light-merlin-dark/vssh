---
name: vssh-docker
description: Use the vssh docker plugin for container inspection, logs, ports, networks, and Docker system information on the target host.
---

# VSSH Docker Plugin

Use this plugin when the task is clearly about containers rather than generic shell execution.

## Primary Commands
- `vssh dls`
- `vssh gdc <term>`
- `vssh sdl <container> --tail 100`
- `vssh ldp [filter]`
- `vssh ldn`
- `vssh sdi`

## Workflow
1. Start with `vssh dls` or `vssh gdc <term>` to confirm the target container.
2. Use `vssh sdl <container> --tail 100` for logs.
3. Use `vssh ldp` and `vssh ldn` for network and port context.
4. Use `vssh sdi` when broader Docker host state matters.

## Examples
```bash
vssh dls
vssh gdc web
vssh sdl web --tail 100
vssh ldp web
vssh ldn
vssh sdi
```

## Safety
- Prefer inspection commands before any Docker mutation through raw shell.
- Confirm container identity with `gdc` before tailing logs or taking follow-up action.

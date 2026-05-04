---
name: vssh-coolify
description: Use the vssh coolify plugin for inspecting and updating Coolify Traefik dynamic configs and reading proxy configuration safely.
---

# VSSH Coolify Plugin

Use this plugin for Coolify proxy and Traefik dynamic configuration work.

## Primary Commands
- `vssh lcd`
- `vssh ldc`
- `vssh vdc <name>`
- `vssh udc ./file.yaml [--name <config>]`
- `vssh gcp`

## Workflow
1. Inspect current config inventory with `vssh lcd`.
2. View the specific target with `vssh vdc <name>`.
3. Update with `vssh udc ./file.yaml --name <name>` if needed.
4. Verify again with `vssh vdc <name>` and optionally `vssh gcp`.

## Examples
```bash
vssh lcd
vssh vdc my-service
vssh udc ./traefik-dynamic.yaml --name my-service
vssh gcp
```

## Safety
- Do not delete Coolify proxy directories manually.
- Prefer uploading explicit local YAML over ad hoc remote edits.
- Verify the final rendered config after every change.

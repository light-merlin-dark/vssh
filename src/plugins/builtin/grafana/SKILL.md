---
name: vssh-grafana
description: Use the vssh grafana plugin for dashboard discovery and targeted dashboard inspection on Grafana-backed hosts.
---

# VSSH Grafana Plugin

Use this plugin when the task is discovering dashboards or reading one dashboard's details.

## Primary Commands
- `vssh lgd`
- `vssh vgd <term>`

## Workflow
1. Use `vssh lgd` to discover what dashboards exist.
2. Use `vssh vgd <term>` with a name, UID, or partial match.
3. Fall back to generic shell only if the plugin surface is insufficient.

## Examples
```bash
vssh lgd
vssh vgd "server metrics"
vssh vgd libsql
```

## Safety
- This plugin is read-oriented. Prefer it over shelling into Grafana internals.
- Use specific search terms when multiple dashboards have similar names.

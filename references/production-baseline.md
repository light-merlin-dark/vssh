# Production Baseline

Use this file as the stable infrastructure baseline for production work done via `vssh`.
Keep it high signal and avoid project/domain churn.

## Environment
- Hosting provider: Hetzner
- Environment role: Production
- Primary control plane: Coolify (Docker-based workloads)
- Primary operational interface: `vssh`
- Coolify dynamic config path: `/data/coolify/proxy/dynamic/`

## Hardware Profile

Current baseline:

- Server class: `Hetzner vServer (KVM virtualized)`
- vCPU: `8`
- Memory (GiB): `15`
- Disk (GiB): `150` (`/dev/sda1` root volume)

Discover/verify current values:

```bash
vssh "hostnamectl || hostname"
vssh "nproc"
vssh "lscpu | egrep 'Model name|CPU\\(s\\)|Thread\\(s\\)|Core\\(s\\)|Socket\\(s\\)'"
vssh "free -h"
vssh "df -h /"
vssh "uptime"
```

## Operational Notes
- Prefer alias commands for speed (`dls`, `gdc`, `sdl`, `lcd`, `vdc`, `udc`, `gcp`).
- Use `vssh lm status` before incident response to confirm remote vs local mode.
- Keep runbooks/tooling references infrastructure-focused; avoid embedding app/domain inventories here.

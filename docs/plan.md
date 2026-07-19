# VSSH Engineering Plan

Last grounded: 2026-07-19

## Objective

Release VSSH 2 as a dependable, portable CLI: a guarded shortcut to native OpenSSH with first-class transfer, streaming, exact exit semantics, explicit automation output, and minimal maintenance surface.

## Ground Truth

- The VSSH 2 implementation is clean and pushed on `main`. It is
  installed locally as 2.0.0, but has not been tagged or published; npm
  `latest` remains 1.8.3.
- Transport is native `ssh`/`scp`, with normal host verification and short-lived OpenSSH control connection reuse.
- Raw mode streams stdin/stdout/stderr and propagates remote exit codes; JSON mode is separated, bounded, and machine-readable.
- Upload/download are core. `upload --mode <octal>` folds permission setting into the operation over the reused connection.
- MCP, the general plugin runtime, plugin credentials/discovery, and usage-promoted help are removed.
- A small compatibility boundary remains for deployed Docker, Coolify, file-edit, local-mode, and legacy execution aliases. It is not an extensibility system and should not grow.
- Audit logs contain only owner-readable bounded metadata, never command text or output.
- The npm package has zero runtime dependencies.
- Release verification is local and explicit; this project does not use GitHub Actions.
- The public root, web, and API consumers are clean and pushed on `main` with
  dev-control v2, stable `.localhost` routing, centralized Stack Admin, and the
  intentional five-plugin `vssh-public` profile.
- The shared `stack guide` now recognizes those current contracts, registry
  installs, and source-controlled Admin handoff. VSSH passes it with
  `success: true`, `strictSuccess: true`, and no blocking findings.
- The measured session-daemon handoff is reconciled in `docs/handoffs/2026-07-19-session-daemon-and-upload-mode.md`: native ControlMaster reuse replaces the proposed custom daemon, while `upload --mode` is retained.

## Verified

- TypeScript typecheck, build, CLI smoke, and the focused unit/integration suite pass.
- Production `npm audit` reports zero known vulnerabilities.
- The actual npm tarball installs and runs under Node.js 18.12.1; its generated executable has the correct mode.
- A live configured target passed doctor, piped stdin, separated JSON stdout/stderr, non-zero exit propagation, upload/download, and retained compatibility smoke checks.
- A fresh live production probe passed `upload --mode 600` with exact checksum
  parity and remote mode 600, then removed the probe artifact.
- Prod-control has adopted command-metadata capability detection: VSSH 2 uses
  one mode-setting upload, while VSSH 1 retains a fail-closed upload-plus-chmod
  compatibility path. Direct 600/700 mode proof and the SEOReport env proof
  pass; native connection reuse reduced the four-component env render from
  10.89s to 3.01s.
- README, changelog, CLI help, command metadata, project guidance, operator skills, and the public testing strategy describe the reduced surface consistently.
- The public consumer has been reduced and pushed as an intentionally authored static product surface plus centralized Stack Admin, analytics, SEO, settings, auth, and errors. StackHTMX, public accounts, tenant-local admin, OSS content automation, and unused plugin routes are removed.

## Release Follow-up

1. Restore npm authentication, publish `@light-merlin-dark/vssh@2.0.0` with release approval, then tag and push the corresponding commit. npm `latest` remains 1.8.3 until this happens.
2. Review `http://vssh.localhost`; Browser Gateway visual acceptance is currently blocked by a Chromium-session 503 even though the VSSH connector and all local services are healthy. Rerun the checked-in visual flows when the worker lane recovers.
3. After local approval, purchase `vssh.io`, provision the source-controlled production edge contract, and cut over through `prod`; do not change DNS manually.
4. Observe real fleet latency and failure telemetry after rollout. Revisit a custom session daemon only if native OpenSSH control reuse is measurably insufficient.

## Product Boundary

- Do not restore MCP or a plugin marketplace without independent usage evidence.
- If a future integration needs MCP, ship it as a separate adapter package so the CLI core remains dependency-free.
- New aliases must demonstrate fleet-wide value that cannot be expressed clearly with a familiar raw command.

# VSSH Engineering Plan

Last grounded: 2026-07-19

## Objective

Release VSSH 2 as a dependable, portable CLI: a guarded shortcut to native OpenSSH with first-class transfer, streaming, exact exit semantics, explicit automation output, and minimal maintenance surface.

## Ground Truth

- VSSH 2 is clean and pushed on public GitHub `main`, published publicly as
  `@light-merlin-dark/vssh@2.0.0`, tagged `v2.0.0`, and installed globally from
  that exact public registry artifact.
- Registry routing is correct and credential-separated: npmjs is the default,
  `@light-merlin-dark` is explicitly public in the repo, and private `@stack`
  packages are host-scoped to `npm.hyper.gdn`. Public npm authenticates as
  `light-merlin-dark`; the private token independently authenticates and
  resolves `@stack/ui-kit@1.6.7`.
- Transport is native `ssh`/`scp`, with normal host verification and short-lived OpenSSH control connection reuse.
- Raw mode streams stdin/stdout/stderr and propagates remote exit codes; JSON mode is separated, bounded, and machine-readable.
- Upload/download are core. `upload --mode <octal>` folds permission setting into the operation over the reused connection.
- MCP, the general plugin runtime, plugin credentials/discovery, and usage-promoted help are removed.
- A small compatibility boundary remains for deployed Docker, Coolify, file-edit, local-mode, and legacy execution aliases. It is not an extensibility system and should not grow.
- Audit logs contain only owner-readable bounded metadata, never command text or output.
- The npm package has zero runtime dependencies.
- Release verification is local and explicit; this project does not use GitHub Actions.
- npm publication is interactive and uses the maintainer's WebAuthn security
  key for proof of presence. VSSH does not use bypass-2FA tokens; staged
  publishing with human approval is the future automation path if needed.
- The public root, web, and API consumers are clean and pushed on `main` with
  dev-control v2, stable `.localhost` routing, centralized Stack Admin, and the
  intentional five-plugin `vssh-public` profile.
- `https://vssh.io` is live through the managed Cloudflare/Prod Control cutover.
  The canonical site, same-origin API, centralized admin hosts, `www` redirect,
  legacy-host redirect, analytics, and SEOReport partner badge all pass remote
  production Browser Gateway acceptance on desktop and mobile.
- The shared `stack guide` now recognizes those current contracts, registry
  installs, and source-controlled Admin handoff. VSSH passes it with
  `success: true`, `strictSuccess: true`, and no blocking findings.
- The measured session-daemon handoff is reconciled in `docs/handoffs/2026-07-19-session-daemon-and-upload-mode.md`: native ControlMaster reuse replaces the proposed custom daemon, while `upload --mode` is retained.

## Verified

- TypeScript typecheck, build, CLI smoke, and the focused unit/integration suite pass.
- Production `npm audit` reports zero known vulnerabilities.
- The published npmjs artifact has SHA-1
  `10371d08159f910df0792dcf3f078604ad5b1dfc`, integrity
  `sha512-ZkOBdonhKayS5wZLkDPksOfiF6sKKOi6P7HRkVp/63PAtPDwB31spwMSOpFo9a4PECCJapAdQIvFAvIEwG3mdw==`,
  and executable mode 755. Its downloaded CLI runs as 2.0.0, and the global
  installation is byte-identical to that registry copy.
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
- DNS incident follow-up is grounded: the first launch attempt populated the
  local router's negative cache before the new apex record existed. Private
  browsing did not bypass that resolver cache. The shared Cloudflare CLI,
  published as private `@merlin/cf@1.2.9`, now
  exposes `cf dns-status <hostname> --wait=<seconds> --json`, which compares
  Cloudflare record state with Cloudflare, Google, Quad9, and the machine
  resolver while treating local stale DNS as a warning rather than failed
  public convergence. VSSH currently reports `healthy` across every lane, and
  `prod app public-proof vssh` passes the root, same-origin API identity, `www`,
  and legacy-host redirect contracts.

## Release Follow-up

1. Observe real fleet latency and failure telemetry after rollout. Revisit a custom session daemon only if native OpenSSH control reuse is measurably insufficient.
2. Extend the managed Cloudflare zone-settings contract before changing edge security settings; the application already redirects HTTP, while the zone still reports `always_use_https=off` and `min_tls_version=1.0`.
3. Measure the public API's eager five-plugin startup cost and move it to the current lazy runtime-descriptor pattern before deciding whether any private operator capability should be removed.

## Product Boundary

- Do not restore MCP or a plugin marketplace without independent usage evidence.
- If a future integration needs MCP, ship it as a separate adapter package so the CLI core remains dependency-free.
- New aliases must demonstrate fleet-wide value that cannot be expressed clearly with a familiar raw command.

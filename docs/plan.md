# VSSH Engineering Plan

Last grounded: 2026-07-19

## Objective

Release VSSH 2 as a dependable, portable CLI: a guarded shortcut to native OpenSSH with first-class transfer, streaming, exact exit semantics, explicit automation output, and minimal maintenance surface.

## Ground Truth

- The VSSH 2 implementation is clean and pushed on public GitHub `main`. It is
  installed locally as 2.0.0, but has not been tagged or published; public npm
  `latest` remains 1.8.3.
- Registry routing is correct and credential-separated: npmjs is the default,
  `@light-merlin-dark` is explicitly public in the repo, and private `@stack`
  packages are host-scoped to `npm.hyper.gdn`. The private token authenticates
  and resolves `@stack/ui-kit@1.6.7`; the stored npmjs token and exported
  `NPM_TOKEN` are both rejected by npmjs and must not be substituted across
  registries.
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

1. Complete one npmjs web login (`npm login --registry=https://registry.npmjs.org/ --auth-type=web`) or replace only the host-bound `//registry.npmjs.org/:_authToken` entry. Then verify `npm whoami --registry=https://registry.npmjs.org/`, publish `@light-merlin-dark/vssh@2.0.0`, inspect registry metadata/tarball execution, and only then tag and push the corresponding commit. Do not change the working private-registry token or `@stack` scope.
2. Review `http://vssh.localhost`. Browser Gateway desktop/mobile acceptance and the final blind Eval Gateway packet are green with no deterministic layout defects or blocker/major findings.
3. `vssh.io` is purchased, registered in Cloudflare, and delegation is proven through authoritative plus public recursive DNS. Prod Control contains the exact apex/`www`/admin edge contract and snapshot rollback; crawler-safe WAF is applied, but DNS remains empty. Provision the centralized-admin secret boundary, prove exact release candidates, and cut over only through the journaled `prod app cutover vssh` path.
4. Observe real fleet latency and failure telemetry after rollout. Revisit a custom session daemon only if native OpenSSH control reuse is measurably insufficient.

## Product Boundary

- Do not restore MCP or a plugin marketplace without independent usage evidence.
- If a future integration needs MCP, ship it as a separate adapter package so the CLI core remains dependency-free.
- New aliases must demonstrate fleet-wide value that cannot be expressed clearly with a familiar raw command.

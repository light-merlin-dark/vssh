# VSSH Engineering Plan

Last grounded: 2026-08-22

## 2.0.1 is staged and blocked on one human step

`2.0.1` is committed on `main` at `a13b7ee` with the config credential guard.
The `Publish` workflow ran against that exact commit and **passed every gate** —
source verification, `npm ci`, `prepublishOnly` (lint, 36 tests, build, smoke,
`0 vulnerabilities`), reproducible-output check, and `npm pack`. It failed only
at the registry:

```
npm error code E404
npm error 404 Not Found - PUT https://registry.npmjs.org/@light-merlin-dark%2fvssh
```

That is not a permissions bug or a workflow bug, and four dispatches narrowed it
to one cause. The workflow side is **measured correct**: the preflight reports
npm `11.17.0` (OIDC needs `>= 11.5.1`) and confirms the OIDC token endpoint is
present, so `id-token: write` is in effect. A stale empty `_authToken` written by
`setup-node`'s `registry-url` was found and stripped — and doing so changed the
error from `E404` to `ENEEDAUTH`.

That change is the diagnosis. **npm only attempts the OIDC exchange when the
registry tells it the package has a trusted publisher.** Falling back to token
auth means the registry offered no such record, so `ENEEDAUTH` here means "no
matching trusted publisher", not "needs a token".

**The remaining step is on npmjs.com and only the maintainer can do it.** On the
package's Settings → Trusted Publisher, add a GitHub Actions publisher naming
organization `light-merlin-dark`, repository `vssh`, workflow file
`publish.yml`, with no environment. Then re-dispatch:

The three values must match exactly, and the workflow prints them itself in the
preflight step so there is nothing to guess:

| Field | Value |
|---|---|
| Repository | `light-merlin-dark/vssh` |
| Workflow filename | `publish.yml` |
| Environment | *(leave empty)* |

Then dispatch against the current `main` tip:

```
gh workflow run Publish --repo light-merlin-dark/vssh --ref main \
  -f version=2.0.1 -f commit=$(git rev-parse origin/main)
```

The commit no longer has to be the branch tip — the job checks out exactly the
commit named and asserts it is an ancestor of `main` — but it must be a commit
that is already landed.

Do not resolve this by creating an npm token. A token would be a standing
credential for a package that is meant to have none, and `2.0.0` — published
before this route existed — is the only release without provenance.

## Bun 1.4 source cohort — source-only

- The root development runner is pinned exactly as `bun@1.4.0` through
  `packageManager`. Publishing and consumer runtime remain Node/npm by product
  contract; this declaration does not turn VSSH into a Bun runtime package.
- The existing text `bun.lock` uses `lockfileVersion = 1` and
  `configVersion = 0`. This is valid, intentional Bun behavior for an existing
  project: it preserves the hoisted linker default. VSSH is not a workspace,
  so Bun documents both config versions as hoisted here. Bun 1.4 accepts the
  lock unchanged under `--frozen-lockfile`; do not rewrite it merely to obtain
  config version 1.
- The authoritative deployment inventory observes no VSSH production
  service. VSSH is an operator CLI and the public `vssh.io` application is a
  separate consumer. This cohort owns source metadata only; there is no runtime
  target, staging lane, deployment, or rollback ceremony to invent.
- Source commit `686b598` is accepted and pushed on `origin/main`, but the
  declared canonical checkout intentionally remains at `fefaa74`: its inherited
  uncommitted `package.json` adds `build:verified`, and Git correctly refused to
  overwrite that foreign work during fast-forward. The inventory therefore keeps
  reporting `source_pin_gap` from the canonical surface. Do not mix the landed
  pin into that dirty file. Once its owner lands or releases the change,
  fast-forward canonical to `origin/main` and remeasure; no source rebuild or
  production action is required.

## Objective

Release VSSH 2 as a dependable, portable CLI: a guarded shortcut to native OpenSSH with first-class transfer, streaming, exact exit semantics, explicit automation output, and minimal maintenance surface.

## Ground Truth

- VSSH 2 is clean and pushed on public GitHub `main`, published publicly as
  `@light-merlin-dark/vssh@2.0.0`, tagged `v2.0.0`, and installed globally from
  that exact public registry artifact.
- Registry routing is correct and credential-separated: npmjs is the default and
  `@light-merlin-dark` is explicitly public in the repo. Any unrelated private
  scope resolves through its own host-scoped registry and its own token, which
  authenticates independently of the public one.
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
- The repository no longer loads a root `.env`. The stale token-based
  `make login` path is a fail-closed tombstone and cannot write a bearer token
  into `~/.npmrc`; `make auth-login` remains the interactive WebAuthn path.
- VSSH runtime target configuration lives in owner-only
  `~/.vssh/config.json`. The retired `.env` SSH override was proven identical
  to that canonical target before removal. Coolify credentials are not part of
  the VSSH 2 runtime or release contract.
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
- The public README now leads with a mandatory SSH/VSSH capability comparison
  that separates inherited OpenSSH behavior from VSSH's full added value:
  structured results, default-target overrides, catastrophic-command
  guardrails, mode-setting transfers, complete diagnostics, content-free audit
  evidence, connection reuse, and versioned agent discovery. The remaining
  narrative expands that table into the command model, quick start, core
  operations, failure semantics, and deliberate safety boundary. GitHub's stale
  MCP/plugin description and topics are corrected, and the repository links to
  `https://vssh.io`.
- A blind Eval Gateway review used two generic developer archetypes at desktop
  and mobile. All four independently understood VSSH, distinguished it from
  plain SSH, and chose install plus setup as the first action; the accepted
  panel mean was 70 at $0.0209. Its supported follow-up—exact guard patterns,
  clearer failure handling, and an environment-override example—is now in the
  README.
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

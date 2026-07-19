# VSSH Engineering Plan

Last grounded: 2026-07-18

## Objective

Release VSSH 2 as a dependable, portable CLI: a guarded shortcut to native OpenSSH with first-class transfer, streaming, exact exit semantics, explicit automation output, and minimal maintenance surface.

## Ground Truth

- The VSSH 2 implementation is complete locally but has not been pushed, tagged, or published.
- Transport is native `ssh`/`scp`, with normal host verification and short-lived OpenSSH control connection reuse.
- Raw mode streams stdin/stdout/stderr and propagates remote exit codes; JSON mode is separated, bounded, and machine-readable.
- Upload/download are core. `upload --mode <octal>` folds permission setting into the operation over the reused connection.
- MCP, the general plugin runtime, plugin credentials/discovery, and usage-promoted help are removed.
- A small compatibility boundary remains for deployed Docker, Coolify, file-edit, local-mode, and legacy execution aliases. It is not an extensibility system and should not grow.
- Audit logs contain only owner-readable bounded metadata, never command text or output.
- The npm package has zero runtime dependencies.
- The measured session-daemon handoff is reconciled in `docs/handoffs/2026-07-19-session-daemon-and-upload-mode.md`: native ControlMaster reuse replaces the proposed custom daemon, while `upload --mode` is retained.

## Verified

- TypeScript typecheck, build, CLI smoke, and the focused unit/integration suite pass.
- Production `npm audit` reports zero known vulnerabilities.
- The actual npm tarball installs and runs under Node.js 18.12.1; its generated executable has the correct mode.
- A live configured target passed doctor, piped stdin, separated JSON stdout/stderr, non-zero exit propagation, upload/download, and retained compatibility smoke checks.
- README, changelog, CLI help, command metadata, project guidance, and operator skills describe the reduced surface consistently.

## Release Follow-up

1. Review the breaking-change release notes and publish `@light-merlin-dark/vssh@2.0.0` only with explicit release approval; then tag and push the corresponding commit.
2. Migrate deployment callers that perform upload plus a separate `chmod` to `vssh upload --mode ...`.
3. Update public homepage copy in the separately controlled `/Users/merlin/_dev/vssh-public` project. Its `AGENTS.md` positioning contract is updated locally, but that repository already contains unrelated dirty changes; isolate its eventual commit.
4. Observe real fleet latency and failure telemetry after rollout. Revisit a custom session daemon only if native OpenSSH control reuse is measurably insufficient.

## Product Boundary

- Do not restore MCP or a plugin marketplace without independent usage evidence.
- If a future integration needs MCP, ship it as a separate adapter package so the CLI core remains dependency-free.
- New aliases must demonstrate fleet-wide value that cannot be expressed clearly with a familiar raw command.

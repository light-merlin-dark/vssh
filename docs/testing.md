# VSSH Testing Strategy

VSSH tests the operating contract around native OpenSSH. The ordinary suite is deterministic, runs without a real server, and never reads the maintainer's `~/.vssh` state.

## Release Gate

Run the complete local gate before publishing:

```bash
npm run verify
npm audit --omit=dev
npm pack --dry-run
```

`npm run verify` performs TypeScript checking, the unit and integration suites, a clean production build, and CLI metadata smoke tests. This project intentionally does not use GitHub Actions.

## Test Lanes

```bash
npm test                  # unit + integration
npm run test:unit         # config, shell, guards, transport helpers
npm run test:integration  # built CLI behavior through fake ssh/scp
```

The integration fixtures in `tests/fixtures/fake-bin/` replace `ssh` and `scp` on `PATH`. They make process arguments, stdin, stdout, stderr, signals, timeouts, and exit codes observable without opening a network connection.

## Required Coverage

- Raw execution streams stdin/stdout/stderr and propagates the remote exit code.
- JSON execution returns one bounded envelope with separated streams, timing, signal, timeout, and exit state.
- Catastrophic-command guards run before any transport process starts.
- Timeouts return 124; guard blocks return 126.
- Upload/download construct native `scp` arguments correctly for files and directories.
- `upload --mode` applies the octal mode over the reused connection and fails the whole operation if that step fails.
- Audit JSONL is owner-readable and contains metadata only—never command text, output, credentials, or file contents.
- Config migration and command-line overrides preserve normal OpenSSH host verification.
- `commands --json` stays parseable and aligned with CLI help.

## Live Acceptance

Live SSH checks are a separate maintainer lane. Use a disposable configured target and verify:

1. `vssh doctor`
2. piped stdin and raw stream separation
3. JSON success and non-zero remote exits
4. upload/download checksum parity
5. `upload --mode 600` remote permissions
6. connection reuse and compatibility aliases still used by deployed projects

Remove probe artifacts when finished. Never make live infrastructure a dependency of `npm test`.

## Packaging Proof

The npm package must contain the generated executable with mode `755`, run on every supported Node version, and have zero runtime dependencies. Always build before inspecting the tarball so deleted source cannot survive in stale `dist/` output.

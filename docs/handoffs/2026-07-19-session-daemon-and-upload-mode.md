# Decision Record: Connection Reuse and Upload Permissions

Date: 2026-07-19
Status: Resolved by the VSSH 2 CLI reduction
Origin: Repeated-call deployment profiling

## Evidence

Deployment workflows make dozens of short VSSH calls. Profiling showed that a fresh SSH handshake dominated each call:

| Operation | Representative time |
|---|---:|
| VSSH CLI startup | ~0.10s |
| Fresh remote no-op | ~1.5s |
| Tiny upload | ~2.1s |
| Native OpenSSH with an existing control connection | ~0.16s |

The old `ssh2` transport created a new client per operation, did not verify host keys, and could not attach to OpenSSH control sockets. The original proposal therefore recommended a local session daemon, an upload mode option, and separate MCP reuse.

## Resolution

VSSH 2 removes the constraints that made a custom daemon necessary:

- Transport now delegates to native `ssh` and `scp`.
- OpenSSH `ControlMaster=auto` and a short `ControlPersist` window reuse authenticated connections across independent CLI processes.
- Normal OpenSSH host verification, `known_hosts`, agent, config, stdin/stdout/stderr, signals, and exit semantics now apply directly.
- The MCP server and general plugin runtime were removed; there is no second long-lived transport to optimize.
- `vssh upload --mode <octal> <local> <remote>` performs copy and permission setting as one VSSH operation. The follow-up `chmod` uses the same OpenSSH control connection and its failure fails the operation.

This reaches the measured native multiplexing path without owning an RPC protocol, daemon lifecycle, lockfiles, socket authorization, channel scheduler, reconnect fallback, or another process to diagnose. A session daemon should not be reintroduced unless measurements show native control reuse is insufficient.

## Verification Contract

- Repeated operations use one control path derived by OpenSSH from the effective connection.
- The control directory is owner-only under `~/.vssh`.
- Upload mode accepts only three- or four-digit octal values.
- A failed permission change returns a failed upload operation.
- Raw commands continue to stream and propagate remote exit codes.
- JSON mode remains one bounded, parseable result.

## Consumer Follow-up

Deployment callers that currently run `vssh upload` followed by a separate remote `chmod` should migrate to `vssh upload --mode ...` after VSSH 2 is released. No consumer should add session-daemon awareness; connection reuse is a transport implementation detail.

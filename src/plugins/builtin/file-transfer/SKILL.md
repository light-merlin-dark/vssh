---
name: vssh-file-transfer
description: Use the vssh file-transfer plugin for uploads and downloads over SFTP, including automatic directory compression on transfer.
---

# VSSH File Transfer Plugin

Use this plugin for moving files or directories between local and remote systems.

## Primary Commands
- `vssh upload <local> <remote>`
- `vssh push <local> <remote>`
- `vssh put <local> <remote>`
- `vssh download <remote> <local>`
- `vssh pull <remote> <local>`
- `vssh get <remote> <local>`

## Behavior
- Directory uploads/downloads are automatically compressed as `tar.gz`.
- Single files transfer directly over SFTP.
- Use this instead of hand-rolled `scp` or `rsync` when the user wants the normal vssh workflow.

## Examples
```bash
vssh upload ./config.yml /etc/app/config.yml
vssh push ./dist /var/www/myapp
vssh download /var/log/app.log ./app.log
vssh pull /var/www/myapp ./backup/myapp
```

## Safety
- Double-check source and destination paths before overwrite-prone transfers.
- Prefer downloads before edits when you need a local backup of a remote file.

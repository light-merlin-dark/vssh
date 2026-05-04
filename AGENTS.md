# VSSH Development Guide

This project uses **bun** for development (faster, better DX) and **npm** for publishing (universal compatibility).

## Product Contract

- Brand is `VSSH`; executable/package is `vssh`
- Product framing is CLI-first, not MCP-first
- MCP remains valuable, but should be presented as optional integration rather than the lead definition of the tool
- Plugins are core product value, but public marketing should not open by listing the plugin inventory

## Public Site Contract

- The public consumer lives at `/Users/merlin/_dev/vssh-public`
- Public copy should stay grounded in this repo's real product surface, especially `README.md`
- Avoid internal Stack/admin/operator language on public pages
- Homepage copy and structure should stay intentionally controlled in the web app, not be auto-rewritten by AI workflows
- If product positioning changes here, update `/Users/merlin/_dev/vssh-public/AGENTS.md` as part of the same work

## Prerequisites

- **Bun**: Install from https://bun.sh (required for development)
- **Node.js 14+**: Required for end users (npm package compatibility)
- **SSH key**: For testing remote connections

## Quick Start

```bash
# Install dependencies
bun install

# Run CLI directly (development mode)
bun run dev

# Build for production
bun run build

# Test the built CLI
./dist/src/index.js --help
```

## Development Workflow

### Running the CLI

```bash
# Direct execution (no build required)
bun run src/index.ts --help
bun run src/index.ts ls -la

# Or use the dev script
bun dev
```

### Testing

```bash
# Run all tests
bun test

# Run specific test suites
bun test:unit          # Unit tests only
bun test:integration   # Integration tests only
bun test:plugins       # Plugin tests only

# Run tests with coverage
bun test:coverage

# Test a specific plugin
bun run test:plugin docker
```

### Building

```bash
# Build TypeScript to dist/
bun run build

# Type checking without emitting
bun run lint
```

### File Transfers

The file-transfer plugin supports automatic directory compression:

**Upload directories:**
- Detects directories automatically
- Creates tar.gz locally
- Uploads compressed archive
- Extracts on server
- Auto-cleanup

**Download directories:**
- Detects remote directories
- Compresses on server (tar.gz)
- Downloads archive
- Extracts locally
- Auto-cleanup

```bash
# Upload directory (auto-zips)
bun run dev upload ./my-folder /var/www/

# Download directory (auto-zips on server)
bun run dev download /var/www/myapp ./local-copy/

# Upload single file (no compression)
bun run dev upload ./config.yml /etc/app/config.yml
```

## Project Structure

```
src/
├── index.ts                  # CLI entry point
├── mcp-server.ts             # MCP server entry point
├── plugins/
│   ├── builtin/
│   │   ├── file-transfer/    # File upload/download with auto-zip
│   │   ├── docker/           # Docker management
│   │   ├── coolify/          # Coolify operations
│   │   ├── grafana/          # Grafana dashboards
│   │   └── file-editor/      # Remote file editing
│   └── types.ts              # Plugin type definitions
├── services/
│   ├── ssh.ts                # SSH/SFTP operations
│   ├── proxy-service.ts      # Command execution proxy
│   └── command-guard.ts      # Safety guards
└── config.ts                 # Configuration management
```

## Plugin Development

Create a new plugin in `src/plugins/builtin/your-plugin/`:

```typescript
// index.ts
import type { VsshPlugin } from '../../types';

export const yourPlugin: VsshPlugin = {
  name: 'your-plugin',
  version: '1.0.0',
  description: 'Your plugin description',

  helpSummary: {
    category: 'Your Category',
    shortSummary: 'Brief description - cmd1, cmd2',
    examples: [
      'vssh cmd1  # Example usage'
    ]
  },

  commands: [
    {
      name: 'your-command',
      aliases: ['yc'],
      description: 'Command description',
      usage: 'vssh your-command [args]',
      handler: async (context, args) => {
        // Implementation
      }
    }
  ]
};

export default yourPlugin;
```

Test your plugin:

```bash
# Enable the plugin
bun run dev plugins enable your-plugin

# Test the command
bun run dev your-command

# Run plugin tests
bun test src/plugins/builtin/your-plugin/tests/
```

## Publishing

Publishing uses **npm** to ensure universal compatibility:

```bash
# Build and publish to npm (users can install with npm)
npm publish

# Users install with:
npm install -g @light-merlin-dark/vssh
```

**Why npm for publishing?**
- Users don't need bun installed
- Maximum compatibility across Node.js versions
- Standard npm registry workflow

## Important Notes

### Default Enabled Plugins

The following plugins are enabled by default:
- `file-transfer` - Upload/download with auto-zip for directories
- `docker` - Docker container management
- `coolify` - Coolify operations

Disabled by default:
- `grafana` - Requires auto-discovery on first use

### TypeScript Configuration

- Source files: `src/`
- Test files: Excluded from build (`**/*.test.ts`)
- Output: `dist/`
- Use `.ts` imports (never `.js` in TypeScript projects)

### Safety Guards

All commands go through safety checks:
- Blocks destructive operations (`rm -rf /`, `dd`, etc.)
- Logs all commands to `~/.vssh/data/logs/`
- Plugin-specific guards can be added

### Development Tips

```bash
# Fast iteration with bun
bun run src/index.ts upload ./test /tmp/test

# Build and test as end-user would see it
bun run build && ./dist/src/index.js --help

# Check for type errors
bun run lint

# Run specific test file
bun test src/plugins/builtin/docker/tests/docker.test.ts
```

## Troubleshooting

**"Module not found" errors:**
- Ensure you're using `.ts` extensions in imports (not `.js`)
- Run `bun install` to ensure dependencies are installed

**SSH connection issues:**
- Verify SSH key exists: `ls ~/.ssh/`
- Test SSH manually: `ssh user@host`
- Run setup: `bun run dev --setup`

**File transfer failures:**
- Check disk space on both local and remote
- Verify remote directory exists: `bun run dev ls /path/to/dir`
- Check permissions on destination

## Performance

Bun is significantly faster than Node.js for development:
- **Startup**: ~3x faster
- **TypeScript execution**: No compilation delay
- **Test execution**: ~2-5x faster
- **Package installation**: ~10-20x faster

This is why we use bun for development while publishing to npm for users.

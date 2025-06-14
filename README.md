# vssh 🤖

**The Model Context Protocol (MCP) enabled SSH proxy for AI agents.** 

Built from the ground up for seamless integration with Claude Code, Claude Desktop, and other AI tools that support MCP. vssh transforms how AI agents manage remote servers by providing a safe, intuitive, and extensible command interface.

## 🚀 Why vssh?

### Native MCP Integration
vssh is a first-class MCP tool, meaning AI agents can:
- Execute server commands naturally without complex SSH syntax
- Access powerful plugin-based commands for Docker, Coolify, and more
- Benefit from built-in safety guards that prevent destructive operations
- Work within permission systems without quote escaping headaches

### Plugin Architecture
Extend vssh with specialized functionality:
- **Docker Plugin**: Container management made simple (`ldc`, `sdl`, `sdi`)
- **Coolify Plugin**: Platform-specific operations (`gcp`, `lcd`)
- **Grafana Plugin**: Dashboard discovery and viewing with encrypted credential storage
- **Custom Plugins**: Build your own for your specific needs

### AI-First Design
- Commands that "just work" - no SSH flag complexity
- Intelligent command parsing that understands AI patterns
- Clear, structured output perfect for AI interpretation
- Comprehensive audit trails for accountability

## 🔌 Model Context Protocol (MCP) Setup

### Quick Start with Claude Code
```bash
# Install vssh globally
npm install -g @light-merlin-dark/vssh

# Add to Claude Code
claude mcp add-json vssh '{
  "type":"stdio",
  "command":"vssh-mcp",
  "env":{"NODE_NO_WARNINGS":"1"}
}'
```

### Available MCP Tools
Once configured, AI agents gain access to:
- `run_command` - Execute any SSH command with safety checks
- `get_local_mode` - Check if commands execute locally or remotely
- `set_local_mode` - Toggle between local and remote execution
- `list_docker_containers` - List all containers (Docker plugin)
- `show_docker_logs` - View container logs (Docker plugin)
- `show_docker_info` - System information dashboard (Docker plugin)
- `get_coolify_proxy_config` - Coolify configuration (Coolify plugin)
- `list_grafana_dashboards` - List all Grafana dashboards (Grafana plugin)
- `view_grafana_dashboard` - View dashboard details (Grafana plugin)
- `edit_file` - Advanced file editing operations (File Editor plugin)
- And many more plugin-based tools!

## ✨ Key Features

### 🎯 Unified Command Execution
All commands now execute through a centralized proxy system:
- Consistent logging and timing for all operations
- Plugin commands automatically use proxy pipeline
- Toggle between local and remote execution modes
- Perfect for development, testing, and production use

### 🤖 AI-Optimized Interface
```bash
# AI agents can use natural commands without complex quoting
vssh docker ps
vssh docker logs my-app --tail 50
vssh 'ps aux | grep node'  # Single quotes for pipes

# AI-friendly quoted syntax
vssh "docker ps -a"         # Entire command in quotes
vssh "ls -la /var/log"      # Perfect for AI permission patterns

# No more struggling with SSH syntax
# ❌ ssh user@host "docker exec -it container bash -c 'cat /etc/config'"
# ✅ vssh docker exec container cat /etc/config
```

### 🛡️ Built-in Safety Guard
Protects against accidentally destructive commands:
```bash
vssh rm -rf /              # ❌ Blocked!
vssh dd if=/dev/zero of=/dev/sda  # ❌ Blocked!
vssh docker system prune -af --volumes  # ❌ Blocked!
```

### 📝 Complete Audit Trail
Every command and output is logged to `~/.vssh/data/logs/` for accountability and debugging.

## 📦 Installation

```bash
# Install globally via npm
npm install -g @light-merlin-dark/vssh

# Run interactive setup
vssh --setup
```

### Prerequisites
- Node.js 14.0.0 or higher
- SSH key-based authentication
- Target server with SSH access

## 🚀 Quick Start

### First-Time Setup
```bash
vssh --setup
```

This interactive setup will:
1. Detect available SSH keys on your system
2. Ask you to select or specify an SSH key
3. Configure your target server (hostname/IP)
4. Save configuration to `~/.vssh/config.json`
5. Enable default plugins (Docker and Coolify)
6. Generate encryption key for secure credential storage

### Basic Usage

#### Core Commands
```bash
# View help and examples
vssh --help

# Run simple commands
vssh ls -la
vssh free -m

# AI-friendly quoted syntax
vssh "ls -la /var/log"       # Perfect for AI agents

# Complex commands with pipes (use single quotes)
vssh 'ps aux | grep node'
```

#### Plugin Commands
```bash
# Docker plugin commands (short aliases)
vssh ldc                      # List docker containers
vssh gdc myapp                # Get docker container
vssh sdl web --tail 100       # Show docker logs
vssh ldp                      # List docker ports
vssh ldn                      # List docker networks
vssh sdi                      # Show docker info

# Coolify plugin commands
vssh gcp                      # Get coolify proxy config
vssh lcd                      # List coolify dynamic configs

# Grafana plugin commands (auto-discovers on first use)
vssh lgd                      # List grafana dashboards
vssh vgd "metrics"            # View dashboard by name/search

# File editor plugin commands
vssh edit-file /etc/app.conf --search "localhost" --replace "example.com"
vssh ef config.yml --regex "version: \d+" --with "version: 2"
vssh ef script.sh --insert-at 0 --content "#!/bin/bash"
vssh ef app.js --dry-run --edits '[{"type":"replace","search":"console.log","replace":"//console.log"}]'

# Plugin management
vssh plugins list             # List all plugins
vssh plugins enable docker    # Enable a plugin
vssh plugins info docker      # Show plugin details
```

## 🧩 Plugin System

vssh features a powerful plugin architecture that extends functionality while maintaining safety and MCP compatibility.

### Built-in Plugins

#### Docker Plugin
Comprehensive Docker management commands:
- `list-docker-containers` (ldc) - List all containers
- `get-docker-container` (gdc) - Find specific container
- `show-docker-logs` (sdl) - View container logs
- `list-docker-ports` (ldp) - Show port mappings
- `list-docker-networks` (ldn) - List networks
- `show-docker-info` (sdi) - System information dashboard

#### Coolify Plugin
Coolify-specific operations:
- `get-coolify-proxy-config` (gcp) - Traefik proxy configuration
- `list-coolify-dynamic-configs` (lcd) - Dynamic configurations

#### Grafana Plugin
Grafana dashboard management with auto-discovery:
- `list-grafana-dashboards` (lgd) - List all dashboards with auto-discovery
- `view-grafana-dashboard` (vgd) - View dashboard details by name/search
- Auto-discovers Grafana containers and credentials on first use
- Securely stores credentials with AES-256-GCM encryption
- No manual configuration required - just run and it works!

#### File Editor Plugin
Advanced file editing capabilities:
- `edit-file` (ef) - Edit files with sophisticated operations
- Supports multiple edit types:
  - Simple search and replace
  - Regular expression replacements with flags
  - Line insertion (by number, after/before pattern)
  - Line deletion (single line or range)
  - Complex multi-operation edits via JSON
- Safety features:
  - Automatic backup creation (`.vssh.backup`)
  - Dry-run mode to preview changes
  - System file protection
- Works with both local and remote files

### Managing Plugins
```bash
# List all plugins and their status
vssh plugins list

# Enable/disable plugins
vssh plugins enable docker
vssh plugins disable coolify

# Get detailed plugin information
vssh plugins info docker
```

### Plugin Benefits
- **Modular**: Enable only what you need
- **Safe**: Plugins can add custom safety guards
- **MCP-Ready**: All plugin commands are exposed as MCP tools
- **Extensible**: Easy to create custom plugins
- **Smart Dependencies**: Automatic runtime dependency checking

### Plugin Development

Creating a vssh plugin is straightforward:

```typescript
import { VsshPlugin } from '@vssh/types';

const myPlugin: VsshPlugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  
  // Declare runtime dependencies
  runtimeDependencies: [
    {
      command: 'kubectl',
      displayName: 'Kubernetes CLI',
      checkCommand: 'kubectl version --client',
      installHint: 'Install kubectl from https://kubernetes.io/docs/tasks/tools/'
    }
  ],
  
  // Plugin commands
  commands: [
    {
      name: 'list-pods',
      aliases: ['lp'],
      description: 'List Kubernetes pods',
      handler: async (context) => {
        // Your command logic here
      }
    }
  ],
  
  // Optional MCP tool definitions
  mcpTools: [
    {
      name: 'list_k8s_pods',
      description: 'List all Kubernetes pods',
      inputSchema: { type: 'object', properties: {} }
    }
  ],
  
  // Optional safety guards
  commandGuards: [
    {
      category: 'kubernetes',
      patterns: [/kubectl\s+delete\s+namespace/],
      message: 'Deleting namespaces is dangerous',
      suggestion: 'Use kubectl delete pod instead'
    }
  ]
};

export default myPlugin;
```

### Runtime Dependencies

vssh automatically checks runtime dependencies before executing plugin commands:

- **Automatic Detection**: Checks if required tools are installed where needed
- **Mode Aware**: Checks locally in local mode, on server in remote mode
- **Clear Error Messages**: Users get helpful installation instructions
- **Optional Dependencies**: Some dependencies can be marked as optional
- **Cached Results**: Dependency checks are cached for performance

Example dependency error:
```
❌ Missing required dependencies:
• Docker is not installed on the server. Please install Docker from https://docker.com
```

## 🎯 Perfect for AI Workflows

### Why AI Assistants Love vssh

1. **MCP Native**: First-class support for Model Context Protocol
2. **Plugin Power**: Specialized commands for common tasks
3. **No Quote Wrestling**: Commands work naturally without complex escaping
4. **Predictable Permissions**: Simple patterns like `Bash(vssh:*)` just work
5. **Clear Feedback**: Structured output perfect for AI interpretation
6. **Safety Net**: Multi-layer protection against dangerous commands

### Common AI Tasks Made Simple

```bash
# Docker Management (via plugin)
vssh ldc                          # Quick container list
vssh sdl myapp --tail 50          # View logs easily
vssh sdi                          # Full system dashboard

# System Monitoring
vssh df -h
vssh free -m
vssh 'ps aux | head -20'

# Coolify Operations (via plugin)
vssh gcp                          # Get proxy configuration
vssh lcd                          # List dynamic configs

# Direct Commands
vssh cat /etc/nginx/nginx.conf
vssh 'find /var/log -name "*.log" -size +100M'

# Local Execution Mode
vssh local-mode status            # Check current mode
vssh local-mode on                # Enable local execution
vssh --local docker ps            # One-off local command
```

## ⚙️ Configuration

Configuration is stored in `~/.vssh/config.json`:

```json
{
  "host": "your-server.com",
  "user": "root",
  "keyPath": "/Users/you/.ssh/id_rsa",
  "localMode": false,
  "encryptionKey": "<auto-generated-base64-key>",
  "plugins": {
    "enabled": ["docker", "coolify"],
    "disabled": ["grafana"],
    "config": {
      "docker": {},
      "coolify": {}
    }
  }
}
```

You can also use environment variables:
- `VSSH_HOST` or `SSH_HOST` - Target server
- `VSSH_USER` - SSH username (default: root)
- `VSSH_KEY_PATH` - Path to SSH key

## 🛡️ Safety Features

Multi-layer protection system:

### Core Guards
- Root filesystem deletion prevention
- Direct disk write operation blocking
- Mass Docker destruction protection
- Critical service disruption prevention
- System shutdown/reboot blocking

### Plugin Guards
- Plugins can add custom safety rules
- Coolify plugin protects configuration directories
- Extensible for domain-specific safety

All blocked commands are logged to `~/.vssh/data/logs/blocked_commands.log`.

## 📁 Data Storage

vssh stores all data in your home directory:
```
~/.vssh/
├── config.json           # SSH configuration with encryption key
├── plugins/
│   └── grafana.enc       # Encrypted Grafana credentials
└── data/
    └── logs/
        ├── proxy_commands.log    # Command history
        └── blocked_commands.log  # Blocked attempts
```

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/light-merlin-dark/vssh.git
cd vssh

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### 🧪 Testing Philosophy

vssh uses a **plugin-centric testing approach** that promotes modularity and independence:

- **Core Tests** (`/tests`): Validate the framework, plugin system, and core utilities only
- **Plugin Tests** (`/src/plugins/*/tests`): Each plugin manages its own test suite
- **No Watch Mode**: Tests run once and complete quickly for deterministic results
- **Minimal Logging**: Tests run silently unless errors occur

This separation ensures plugins remain truly independent while leveraging shared testing utilities. Watch mode is intentionally not supported to maintain fast, reliable test execution.

```bash
# Run core framework tests only
npm test

# Run all plugin tests
npm run test:plugins

# Run everything (core + plugins)
npm run test:all

# Test a specific plugin
npm run test:plugin docker

# List available plugins with test status
npm run test:list-plugins
```

For detailed testing documentation, see [docs/testing.md](docs/testing.md).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ by [@EnchantedRobot](https://twitter.com/EnchantedRobot)

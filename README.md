# vssh 🤖

An AI-friendly SSH command proxy that makes remote server management safer and more natural. Designed specifically for seamless integration with AI assistants like Claude, ChatGPT, and other LLMs. Now supports the Model Context Protocol (MCP) for native integration with Claude Code and Claude Desktop.

## 🎯 Built for AI Assistants

vssh solves a critical problem: AI assistants often struggle with SSH command syntax and safety when managing remote servers. This tool provides:

- **Natural Command Flow**: No complex SSH flags or escaping - just `vssh docker ps`
- **Smart Quote Handling**: AI assistants can use commands naturally without worrying about quote escaping
- **Permission-Friendly**: Works perfectly with Claude Code's permission system
- **Safety by Default**: Prevents accidental execution of destructive commands

## ✨ Key Features

### 🔌 Native MCP Support
```bash
# Use with Claude Code or Claude Desktop
claude mcp add-json vssh '{
  "type":"stdio",
  "command":"vssh-mcp",
  "env":{"NODE_NO_WARNINGS":"1"}
}'
```

### 🤖 AI-Optimized Interface
```bash
# AI assistants can use natural commands without complex quoting
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

### Basic Usage
```bash
# View help and examples
vssh --help

# Run simple commands
vssh ls -la
vssh docker ps
vssh free -m

# Commands with arguments
vssh docker logs my-container --tail 100

# AI-friendly quoted syntax
vssh "docker ps"             # Entire command in quotes
vssh "ls -la /var/log"       # Perfect for AI assistants

# Complex commands with pipes (use single quotes)
vssh 'docker ps --format "table {{.Names}}\t{{.Status}}" | grep healthy'
```

## 🔌 Using with Model Context Protocol (MCP)

vssh now includes native MCP support for seamless integration with Claude Code and Claude Desktop.

### MCP Setup

1. **Install vssh globally**:
   ```bash
   npm install -g @light-merlin-dark/vssh
   ```

2. **Add to Claude Code**:
   ```bash
   # Find the path to vssh-mcp
   which vssh-mcp
   
   # Add to Claude Code (replace path with your actual path)
   claude mcp add-json vssh '{
     "type":"stdio",
     "command":"/usr/local/bin/vssh-mcp",
     "env":{"NODE_NO_WARNINGS":"1"}
   }'
   ```

3. **Or add to project-level `.mcp.json`**:
   ```json
   {
     "vssh": {
       "type": "stdio",
       "command": "/usr/local/bin/vssh-mcp",
       "env": {"NODE_NO_WARNINGS": "1"}
     }
   }
   ```

### MCP Tool Usage

Once configured, Claude will have access to the `run_command` tool:

```
Tool: run_command
Description: Execute a shell command on the remote host
Parameters:
  - command (string, required): Full shell command exactly as it would be typed in a terminal
```

## 🎯 Perfect for AI Workflows

### Why AI Assistants Love vssh

1. **No Quote Wrestling**: Commands work naturally without complex escaping
2. **Predictable Permissions**: Simple patterns like `Bash(vssh:*)` just work
3. **Native MCP Support**: Direct integration with Claude Code and Claude Desktop
4. **Clear Feedback**: Every command shows execution status and timing
5. **Safety Net**: Dangerous commands are caught before execution

### Common AI Tasks Made Simple

```bash
# Docker Management
vssh docker ps
vssh docker logs app --tail 50
vssh docker exec db mysql -e "SHOW DATABASES"
vssh 'docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"'

# System Monitoring
vssh df -h
vssh free -m
vssh 'ps aux | head -20'
vssh 'tail -f /var/log/nginx/access.log | grep 404'

# File Operations
vssh ls -la /etc/nginx/
vssh cat /etc/nginx/nginx.conf
vssh 'find /var/log -name "*.log" -size +100M'
```

## ⚙️ Configuration

Configuration is stored in `~/.vssh/config.json`:

```json
{
  "host": "your-server.com",
  "user": "root",
  "keyPath": "/Users/you/.ssh/id_rsa"
}
```

You can also use environment variables:
- `VSSH_HOST` or `SSH_HOST` - Target server
- `VSSH_USER` - SSH username (default: root)
- `VSSH_KEY_PATH` - Path to SSH key

## 🛡️ Safety Features

The command guard protects against:
- Root filesystem deletion
- Direct disk write operations
- Mass Docker destruction
- Critical service disruption
- System shutdown/reboot

All blocked commands are logged to `~/.vssh/data/logs/blocked_commands.log`.

## 📁 Data Storage

vssh stores all data in your home directory:
```
~/.vssh/
├── config.json           # SSH configuration
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

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Built with ❤️ by [@EnchantedRobot](https://twitter.com/EnchantedRobot)

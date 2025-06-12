# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.4.6] - 2025-06-12

### Fixed
- Fixed npm package bin paths to correctly point to compiled JavaScript files
- Resolved "command not found" error after global npm installation
- Ensured executable permissions are set on compiled bin files

## [1.5.0] - 2025-06-12

### Added
- **Runtime Dependency System**: Smart dependency checking for plugin commands
  - Automatic detection of required tools (Docker, kubectl, etc.)
  - Mode-aware checking (local vs remote server)
  - Clear error messages with installation instructions
  - Optional dependencies support
  - Dependency check result caching for performance
  - No manual configuration required - checks happen automatically

- **Plugin Development Enhancements**
  - New `runtimeDependencies` field for declaring external tool requirements
  - Centralized dependency checking in plugin registry
  - Clean separation between plugin dependencies and runtime dependencies
  - Comprehensive test coverage for dependency checking

### Changed
- **Plugin System Architecture**
  - Dependency checks now happen at command execution time, not plugin load time
  - Plugin loading is faster - no dependency checks during startup
  - Config saving now integrated into plugin enable/disable operations
  - Plugin registry now uses dedicated DependencyChecker service

### Fixed
- Coolify plugin now loads correctly even when Docker plugin isn't available locally
- Plugin enable/disable operations now persist to config file
- Fixed plugin command recognition in main CLI flow

## [1.5.0] - 2025-06-12

### Added
- **Grafana Plugin**: Auto-discovering dashboard management
  - `list-grafana-dashboards` (lgd) - Auto-discovers Grafana containers and credentials
  - `view-grafana-dashboard` (vgd) - Search and view dashboard details
  - Secure credential storage with AES-256-GCM encryption
  - Zero-configuration setup - credentials discovered from container environment
  - Multi-word search support for finding dashboards
  - Automatic encryption key generation stored in config

- **Enhanced Encryption Service**
  - Config-based encryption key storage (no separate key files)
  - Transparent encryption/decryption for plugin credentials
  - AES-256-GCM with authenticated encryption
  - Automatic key generation on first use

- **Improved Testing Infrastructure**
  - Plugin-specific test commands via Makefile
  - Suppressed unnecessary logging during test runs
  - Fixed all test failures including encryption service tests
  - Added `test-all` Makefile target for comprehensive testing

### Changed
- **Configuration Structure**
  - Added `encryptionKey` field for storing encryption keys
  - Grafana plugin disabled by default (requires container to be useful)
  - Encryption is now completely transparent to users

- **Test Output**
  - Minimal logging during tests (only errors shown)
  - Cleaner CI/CD integration with reduced noise
  - Plugin loader warnings suppressed in test environment

### Fixed
- Dashboard search now properly handles multi-word queries
- Process.exit mocking in tests for proper test completion
- Encryption service tests aligned with config-based key storage
- Vite CJS deprecation warnings suppressed in plugin tests

### Technical Details
- Grafana plugin uses Docker inspection for auto-discovery
- Credentials extracted from container environment variables
- Plugin credentials stored in `~/.vssh/plugins/grafana.enc`
- Search algorithm matches all words in query (order-independent)

## [1.4.1] - 2025-06-11

### Added
- **Proxy as Core Plugin**: Converted proxy functionality into a native plugin
  - `vssh proxy <command>` - Execute commands via proxy (aliases: run, exec)
  - `vssh local-mode [on|off|status]` - Manage local execution mode
  - Proxy plugin loads first and cannot be disabled
  - All plugin commands now execute through proxy by default

- **Local Execution Mode**: Flexible command execution options
  - `--local` flag for one-off local command execution
  - Persistent local mode setting saved in configuration
  - When local mode is enabled, all commands execute locally by default
  - MCP tools `get_local_mode` and `set_local_mode` for AI agents

- **Unified Command Pipeline**: Consistent execution for all commands
  - All Docker and Coolify commands use ProxyService
  - Automatic logging and timing for all operations
  - Skip logging option for internal plugin operations
  - Commands execute on remote server by default

### Changed
- **Architecture Refactoring**: Major internal improvements
  - Created ProxyService to centralize command execution
  - Updated PluginContext to include ProxyService and local mode state
  - Modified all plugin commands to use proxy by default
  - Enhanced plugin registry to support new architecture

- **Developer Experience**
  - Makefile converted to example template (Makefile.example)
  - Added smart release process: `make push` handles everything
  - Intelligent version management compares npm vs local
  - Removed unnecessary link/unlink commands

### Technical Details
- ProxyService supports both local and remote execution
- Command guard integration preserved through proxy
- Full backward compatibility maintained
- Tests updated for new architecture

## [1.4.0] - 2025-06-11

### Added
- **Plugin-Centric Testing Architecture**: Complete overhaul of testing strategy
  - Plugins now contain and manage their own test suites (`/src/plugins/*/tests`)
  - Core tests focus only on framework and plugin system functionality
  - Shared testing utilities available via `@vssh/test-utils`
  - Plugin test runner discovers and executes all plugin tests
  - Clear separation between core and plugin testing concerns

- **Testing Utilities for Plugin Developers**
  - `createMockContext()` - Create mock plugin context with SSH service
  - `MockSSHService` - Comprehensive SSH command mocking (never executes real commands)
  - `captureOutput()` - Capture stdout/stderr for testing
  - `loadFixture()` - Load test fixtures from plugin test directories

- **Core Framework Tests**
  - Command guard service tests with 97% coverage
  - Plugin registry and loader tests
  - Configuration loading tests
  - All tests run without SSH connections or command execution

### Changed
- **Test Commands**: Reorganized to reflect plugin-centric approach
  - `npm test` - Runs core framework tests only
  - `npm run test:plugins` - Runs all plugin tests via test runner
  - `npm run test:all` - Runs both core and plugin tests
  - `npm run test:plugin <name>` - Run specific plugin tests

- **Test Coverage**: Focused on core framework components
  - Coverage excludes plugin implementations (tested separately)
  - Coverage excludes entry points and CLI (integration tested)
  - Minimum 55% coverage threshold for core components

- **Documentation**: Updated testing philosophy and guidelines
  - Clear separation of core vs plugin testing responsibilities
  - Examples and best practices for plugin test development
  - Guidance for third-party plugin developers
  - Emphasis on test safety - no destructive commands ever executed

## [1.3.0] - 2025-06-11

### Added
- **Plugin System**: Modular architecture for extending vssh functionality
  - Plugin registry with dependency management
  - Plugin lifecycle hooks (onLoad/onUnload)
  - Dynamic command registration
  - MCP tool generation from plugin commands
  - Custom command guard extensions per plugin
  
- **Docker Plugin**: Comprehensive Docker management commands
  - `list-docker-containers` (ldc) - List all containers with formatted output
  - `get-docker-container` (gdc) - Find containers by pattern with flexible matching
  - `show-docker-logs` (sdl) - View logs from multiple containers concurrently
  - `list-docker-ports` (ldp) - Display port mappings with status indicators
  - `list-docker-networks` (ldn) - List Docker networks
  - `show-docker-info` (sdi) - Comprehensive system dashboard with concurrent data fetching
  
- **Coolify Plugin**: Platform-specific operations
  - `get-coolify-proxy-config` (gcp) - Retrieve Traefik proxy configuration
  - `list-coolify-dynamic-configs` (lcd) - List and display dynamic configurations
  - Custom command guards for Coolify directory protection
  - Dependency on Docker plugin
  
- **Plugin Management CLI**
  - `vssh plugins list` - Show all plugins with enable/disable status
  - `vssh plugins enable <name>` - Enable plugin and its dependencies
  - `vssh plugins disable <name>` - Safely disable plugins
  - `vssh plugins info <name>` - Display detailed plugin information
  
- **Enhanced MCP Integration**
  - Automatic MCP tool registration for all plugin commands
  - Plugin commands exposed with snake_case naming (e.g., `list_docker_containers`)
  - Structured output capture for AI-friendly responses
  - Plugin tool discovery and dynamic registration

### Changed
- **Command Naming Convention**: Adopted plugin-prefixed aliases to prevent conflicts
  - Short aliases now include plugin prefix (e.g., `ldc` instead of `c` for containers)
  - Long commands follow pattern: `<action>-<plugin>-<resource>`
  - MCP tools use snake_case equivalents
  
- **Configuration Structure**: Extended to support plugin settings
  - Added `plugins` section with enabled/disabled lists
  - Per-plugin configuration support
  - Default plugins (docker, coolify) enabled on setup
  
- **Architecture Improvements**
  - Refactored CommandGuard into extensible CommandGuardService
  - Separated SSH service configuration from types
  - Enhanced error handling and logging throughout
  
### Technical Details
- Plugin interface with TypeScript support
- Circular dependency detection
- Safe plugin loading/unloading
- Concurrent operation patterns preserved from original codebase
- 10-second TTL caching for Docker operations
- Comprehensive audit logging maintained

## [1.2.0] - 2025-06-10 [Previous Release]

### Added
- Native Model Context Protocol (MCP) support for integration with Claude Code and Claude Desktop
- New `vssh-mcp` binary that exposes vssh as an MCP server
- MCP `run_command` tool for executing SSH commands through the MCP interface
- Support for `-c` and `--command` flags for command execution (kept for compatibility)
- MCP integration documentation and setup instructions

### Changed
- Updated help text to promote quoted command syntax for AI assistants
- Enhanced package.json with MCP-related keywords and dependencies
- Improved command parsing to support single argument command strings
- CommandGuard now displays warnings for suspicious patterns even when commands are not blocked

## [1.0.1] - 2025-06-08

### Added
- Interactive SSH configuration setup with `vssh --setup`
- Automatic SSH key detection for easier setup
- Self-contained configuration in `~/.vssh/` directory
- Support for multiple SSH key types (RSA, ED25519, ECDSA, DSA)
- Persistent server configuration in `~/.vssh/config.json`

### Changed
- Transformed from local tool to npm-publishable package
- Migrated from Bun to Node.js for broader compatibility
- Updated help text to emphasize AI-friendly features
- Moved data storage from hardcoded path to user home directory

### Fixed
- Removed hardcoded project paths for portability
- Improved error handling for missing SSH configuration

## [1.0.0] - 2025-06-06

### Added
- Initial release extracted from coolify-helper project
- SSH command proxy functionality
- Built-in command safety guard
- Comprehensive audit logging
- Support for complex shell commands with pipes and redirects
- Environment variable configuration (VSSH_HOST, VSSH_USER, VSSH_KEY_PATH)

### Security
- Command blocking for dangerous operations (rm -rf /, dd to disk, etc.)
- Separate logging for blocked commands
- SSH key-based authentication only

---

[1.4.6]: https://github.com/light-merlin-dark/vssh/compare/v1.5.0...v1.4.6
[1.5.0]: https://github.com/light-merlin-dark/vssh/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/light-merlin-dark/vssh/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/light-merlin-dark/vssh/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/light-merlin-dark/vssh/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/light-merlin-dark/vssh/compare/v1.0.1...v1.2.0
[1.0.1]: https://github.com/light-merlin-dark/vssh/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/light-merlin-dark/vssh/releases/tag/v1.0.0
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **SSH-Compatible Output System**: Strategic refinement to honor "SSH with safety guards" promise
  - **SSH-compatible by default**: Commands return standard SSH output for zero-friction adoption
  - **JSON opt-in mode**: `--json` flag provides structured output for automation needs
  - **Clean output separation**: Raw output identical to SSH, JSON available when requested
  - **Field filtering**: `--json --fields output,duration` for selective automation data
  - **Optimized architecture**: Simple `executeProxy` approach with emoji removal
  - **Examples**:
    ```bash
    vssh "docker ps"                    # Default: SSH-compatible output
    vssh --json "docker ps"            # Structured JSON for automation
    vssh --json --fields output "docker ps"  # Selective JSON fields
    ```

- **Comprehensive Testing Infrastructure**: Enterprise-grade test coverage with Bun test runner
  - **91 total tests**: 62 unit tests, 29 integration tests, 12 performance tests
  - **SSH Compatibility Tests**: Validates identical output to SSH commands
  - **JSON Opt-in Tests**: Ensures structured output works when requested
  - **Performance Benchmarks**: Command execution speed and JSON serialization performance
  - **Advanced Test Utilities**: OutputCapture, JSON validation, and performance measurement tools
  - **71.90% line coverage**: Comprehensive coverage across all core components

- **Enhanced ProxyService Architecture**: Modern execution engine with output mode support
  - **Extended ProxyOptions**: Added `outputMode` and `jsonFields` parameters
  - **Structured CommandResult**: Enhanced result objects with exit codes and local execution flags
  - **JSONResponse Schema**: Standardized JSON response format for AI consumption
  - **Proper stderr/stdout routing**: Metadata separation for reliable parsing
  - **Error handling**: Structured error responses in JSON format

- **Clean Break Implementation**: Eliminated technical debt with modern architecture
  - **No backward compatibility**: JSON-first design without legacy baggage
  - **Legacy consolidation**: `proxy.ts` now routes through modern ProxyService
  - **Smart flag parsing**: Handles multiple output mode flags correctly
  - **Help system updates**: New `--help-output` flag with comprehensive examples

### Changed
- **Default Behavior**: Transformed from emoji-prefixed human output to AI-first JSON output
- **CLI Flag Parsing**: Enhanced to handle multiple output mode flags and field filtering
- **Error Handling**: Structured error responses across all output modes
- **Documentation**: Updated plan.md with completed implementation and testing strategy

### Performance
- **JSON Serialization**: <1ms overhead for typical responses
- **Memory Usage**: No significant increase vs legacy implementation
- **Field Filtering**: Significant payload reduction with selective output
- **Test Execution**: Optimized test suite with 91 passing tests in ~25 seconds

### Breaking Changes
- **Default Output Mode**: Commands now return JSON by default instead of emoji-prefixed text
- **Output Format**: Structured JSON responses replace free-form text output
- **stderr/stdout Separation**: Metadata now routes to stderr in JSON/quiet modes

### Migration Guide
- **For AI Users**: No changes needed - JSON output is now default
- **For Human Users**: Use `--raw` flag for previous emoji-prefixed behavior
- **For Scripts**: Use `--quiet` flag for clean command output without metadata
- **For Selective Data**: Use `--json --fields field1,field2` for minimal output

## [1.7.5] - 2025-11-06

### Fixed
- **Pure SSH Compatibility**: Removed all decorative output for true SSH proxy behavior
  - Removed emoji output (🚀, ✅, ❌) from all console messages
  - Removed "Executing..." and "Completed in Xms" console messages
  - Command execution logs now only write to `~/.vssh/data/logs/proxy_commands.log`
  - Console output is now identical to SSH command output
  - Logger messages stripped of emoji prefixes for clean error reporting

### Changed
- **Package Structure**: Fixed bin paths in package.json
  - Updated from `dist/src/index.js` to `dist/index.js` to match TypeScript build output
  - Updated from `dist/src/mcp-server.js` to `dist/mcp-server.js`
  - Ensures proper global installation via npm

### Performance
- **Reduced Console Noise**: Eliminated unnecessary console output for faster terminal rendering
- **File-Only Logging**: Command history and timing data preserved in log files without console overhead

## [1.8.0] - 2025-07-01

### Added
- **Dynamic Help System**: Complete redesign of help text for optimal AI and user experience
  - Plugin-based help summaries with short and long descriptions
  - Categorized command display (Core, Infrastructure, Monitoring, File Management)
  - Dynamic help generation from enabled plugins only
  - Comprehensive examples and key commands for each plugin
  - Template-based help system for consistent documentation

### Removed
- **Claude Detection Message**: Removed the greeting message when Claude calls vssh directly
  - Streamlined experience for direct CLI usage
  - Cleaner output for AI assistants and human users

### Enhanced
- **Plugin Interface**: Extended with helpSummary support
  - Added PluginHelpSummary interface with shortSummary, longSummary, category, keyCommands, and examples
  - All builtin plugins now include comprehensive help summaries
  - Help system automatically categorizes and displays plugin commands

## [1.7.0] - 2025-06-27

### Added
- **Enhanced MCP Server Architecture**: Major improvements to plugin system and MCP integration
  - Plugins now define their own MCP tools directly for better modularity
  - Automatic MCP tool registration from plugin definitions
  - Improved handler resolution for both CLI and MCP contexts
  - Resource handlers for plugins to provide MCP resources

- **Docker Plugin v2.0.0**: Enhanced with direct MCP tool support
  - All Docker commands now have corresponding MCP tools
  - Added container resource handler for MCP resource queries
  - Improved command descriptions and help text
  - Better integration with vssh's proxy service

- **Coolify Blueprint**: Comprehensive documentation for migrating Coolify functionality
  - Created `docs/ch-blueprint.md` with complete API integration guide
  - Documented all Coolify API endpoints with curl examples
  - Provided implementation structure for standalone coolify-helper project
  - Included end-to-end test script specifications

### Enhanced
- **Plugin Architecture**: Significant improvements to plugin system
  - Added `mcpTools` property to plugin interface for direct MCP tool definitions
  - Implemented automatic MCP tool mapping from plugin commands
  - Added resource handler support for plugins
  - Improved type safety with better TypeScript interfaces
  - Added response utilities for consistent plugin output

- **Test Infrastructure**: Improved testing with Bun for faster execution
  - All tests now run with `bun run test` for improved speed
  - Fixed Docker plugin test expectations (version 2.0.0)
  - Fixed Grafana plugin test argument handling
  - Verified file-editor plugin functionality with integration tests

### Fixed
- **Test Failures**: Resolved multiple test issues
  - Docker plugin tests updated for version 2.0.0 and new description
  - Grafana view-dashboard tests fixed for proper argument passing
  - All core tests (51 tests) now passing successfully

### Developer Experience
- **Migration Utilities**: Added utilities to help migrate existing code
  - Created migration helpers for updating plugin definitions
  - Added response formatting utilities for consistent output
  - Improved error handling in plugin loading

### Documentation
- **Updated Plugin Development**: Enhanced documentation for plugin creators
  - Clear examples of MCP tool definitions within plugins
  - Resource handler implementation examples
  - Best practices for plugin architecture

## [1.6.1] - 2025-06-23

### Added
- **Simplified Installation**: New `vssh install` command for easy Claude Code setup
  - Users can now install with just `vssh install` instead of complex `claude mcp add-json` command
  - Automatic detection of missing dependencies with helpful error messages
  - Checks for vssh-mcp availability before attempting installation
  - Provides fallback manual installation instructions if needed

- **call-mcp Utility**: Developer tool for programmatic MCP server interaction
  - Located in `src/utils/call-mcp.ts` for testing and scripting
  - Eliminates need for echo commands when interacting with MCP servers
  - Provides both CLI and library interfaces
  - Enables better integration testing and automation
  - Includes comprehensive documentation in `src/utils/README.md`

### Enhanced
- **Claude Detection**: Improved to skip warning messages for utility commands
- **Developer Experience**: Added MCP server integration tests using call-mcp utility
- **Documentation**: Updated README with simplified installation instructions

## [1.5.9] - 2025-06-14

### Fixed
- **MCP Tool Argument Handling**: Fixed critical issue where MCP tools were not receiving arguments correctly
  - `parseFlags()` was mutating the args array in-place, causing positional arguments to be lost
  - MCP tools like `view_grafana_dashboard` were searching for command name instead of actual arguments
  - Added array cloning before flag parsing to preserve original arguments
  - Implemented defensive fallbacks for search term extraction (supports `search` and `query` properties)
  - Improved Zod schema with default array to prevent silent failures
  - Added comprehensive unit tests covering MCP and CLI argument handling scenarios
  - All MCP tools now correctly process arguments matching CLI behavior

### Added
- **MCP Argument Testing**: New test suite specifically for MCP tool argument handling
  - Tests positional arguments, named arguments, and fallback scenarios
  - Validates argument extraction works consistently between MCP and CLI contexts
  - Prevents regression of argument handling issues

## [1.5.2] - 2025-06-14

### Added
- **Smart Claude Detection**: Automatically detects when Claude (Anthropic's AI assistant) is calling the CLI directly
  - Detects Claude-specific environment variables (`CLAUDECODE=1`, `CLAUDE_CODE_ENTRYPOINT=cli`)
  - Checks for non-TTY execution context as secondary indicator
  - Displays friendly guidance to use MCP tools instead of direct CLI
  - Lists available MCP tools with examples for better integration
  - Still executes commands for backward compatibility
  - Helps prevent AI assistants from using suboptimal integration methods

### Enhanced
- **AI Integration**: Improved guidance for AI assistants to use the proper MCP tools
- **User Experience**: Clear messaging when incorrect usage patterns are detected

## [1.6.0] - 2025-06-14

### Added
- **File Editor Plugin**: Advanced file editing capabilities for AI agents and CLI users
  - New `edit-file` command (alias: `ef`) with sophisticated editing operations
  - Support for multiple edit types:
    - Simple search and replace: `--search "old" --replace "new"`
    - Regular expression replacements: `--regex "pattern" --with "replacement" --flags "g"`
    - Line insertion: `--insert-at 5 --content "text"` or `--after/--before "pattern"`
    - Line deletion: `--delete-line 10` or range deletion
    - Complex JSON-based edits: `--edits '[{"type":"replace","search":"foo","replace":"bar"}]'`
  - Safety features:
    - Automatic backup creation (`.vssh.backup` files)
    - Dry-run mode (`--dry-run`) to preview changes
    - System file protection (blocks editing of /etc, /sys, /proc, etc.)
  - Full MCP integration:
    - Exposed as `edit_file` MCP tool
    - Comprehensive parameter schema for AI agents
    - Works with both local and remote files via SSH
  - Examples:
    ```bash
    vssh edit-file config.yml --search "localhost" --replace "example.com"
    vssh ef app.js --regex "console\\.log" --with "// console.log" --flags "g"
    vssh ef script.sh --insert-at 0 --content "#!/bin/bash"
    vssh ef test.txt --dry-run --edits '[{"type":"delete","line":5}]'
    ```

### Enhanced
- **Plugin System**: File Editor plugin seamlessly integrates with existing architecture
- **MCP Tools**: Added `edit_file` tool for AI agents to perform sophisticated file edits
- **Safety Guards**: Extended command guard system to protect critical system files from editing

## [1.5.1] - 2025-06-13

### Added
- **Dynamic MCP Context**: Plugin commands now automatically contribute to MCP tool descriptions
  - Each plugin can define `mcpContext` to document its commands for AI agents
  - The `run_command` MCP tool dynamically includes all enabled plugin commands
  - AI agents instantly see available commands without separate discovery
  - Commands are organized by plugin sections (Docker, Coolify, Grafana)

### Changed
- **MCP Tool Descriptions**: Enhanced with plugin-aware command examples
  - Clear examples for each plugin's commands
  - Better formatting with bullet points
  - Grouped by functionality for easier AI comprehension
  - Updates automatically based on enabled plugins

## [1.5.0] - 2025-06-12

### Added
- **Enhanced Release Process**: Comprehensive post-release validation
  - Automated version verification against npm registry
  - Real SSH connection testing with `vssh echo "Hello world"`
  - Clear success/failure indicators for CI/CD integration
  - Intelligent retry logic with registry propagation delays

- **TypeScript Migration**: All scripts converted to TypeScript
  - `smart-version.ts` - Intelligent version management
  - `post-validation.ts` - Release validation with SSH testing
  - `list-plugins.ts` - Plugin discovery utility
  - `test-plugin-dynamic.ts` - Dynamic plugin testing
  - Improved type safety and maintainability

### Changed
- **Release Workflow**: Streamlined and more reliable
  - Makefile delegates validation to dedicated TypeScript script
  - Better error handling and user feedback
  - Actual SSH testing replaces simple help text verification
  
- **Development Structure**: Scripts directory improvements
  - Scripts folder excluded from repository (development only)
  - TypeScript source files for all tooling
  - Cleaner project structure

### Fixed
- Added proper config validation to prevent cryptic "ENOENT: no such file or directory" errors
- Show helpful error messages when SSH configuration has placeholder/test values
- Check if SSH key file exists before attempting connection
- Guide users to run `vssh --setup` when configuration is invalid
- Fixed npm package bin paths to correctly point to compiled JavaScript files
- Resolved "command not found" error after global npm installation
- Ensured executable permissions are set on compiled bin files

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

[1.5.1]: https://github.com/light-merlin-dark/vssh/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/light-merlin-dark/vssh/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/light-merlin-dark/vssh/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/light-merlin-dark/vssh/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/light-merlin-dark/vssh/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/light-merlin-dark/vssh/compare/v1.0.1...v1.2.0
[1.0.1]: https://github.com/light-merlin-dark/vssh/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/light-merlin-dark/vssh/releases/tag/v1.0.0
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-01-10

### Added
- New `-c` and `--command` flags for AI-friendly command execution
- Better support for AI permission patterns like `vssh -c:*`
- Documentation and examples for the new command flag usage

### Changed
- Improved command parsing to support single argument command strings
- Updated help text to prominently feature the new `-c` flag option

## [1.2.0] - 2025-01-08

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

## [1.1.0] - 2025-01-07

### Added
- Enhanced help text optimized for AI assistants
- Clear examples for Docker and system commands
- Notes section specifically for AI usage patterns

### Changed
- Improved command reconstruction for better quote handling
- Updated safety messages to be more informative

## [1.0.0] - 2025-01-06

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
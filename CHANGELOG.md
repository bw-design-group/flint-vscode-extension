# Changelog

All notable changes to the Flint for Ignition extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-07-10

### Added
- Bundled the Flint language-server proxy inside the extension. The gateway-backed
  Jython language server (completion, hover, go-to-definition, references, syntax
  diagnostics, symbols) now works with no external installation — only a configured
  gateway and API token are required. `flint.languageServer.proxyPath` remains an
  advanced override for external proxy binaries.
- Public documentation site at https://flint.docs.bwdesigngroup.dev covering setup,
  every feature area, the Designer Bridge module, and full configuration,
  settings, and command references.
- End-to-end test suite for the bundled language-server proxy
  (`npm run test:lsp-e2e`), exercised against a live gateway.

### Fixed
- Corrected the Marketplace install identifier, version badges, settings table,
  and keyboard-shortcut documentation in the README.
- Replaced environment-specific hostnames in `example-flint.config.json` with
  generic examples.

## [1.0.1] - 2026-07-09

### Changed
- Relicensed under the MIT License.

## [1.0.0] - 2026-07-09

### Changed
- First stable release, now published from the public repository at [bw-design-group/flint-vscode-extension](https://github.com/bw-design-group/flint-vscode-extension).

## [0.14.0] - 2026-07-01

### Added
- Added a gateway-backed language server for Ignition Jython (Python 2.7) that launches automatically from the selected `flint.config.json` gateway (using its configured API token) and provides completion, hover, go-to-definition, references, and diagnostics with no Designer running. Configurable via `flint.languageServer.enabled` and `flint.languageServer.proxyPath`.

## [0.12.0] - 2026-02-23

### Changed
- Update license to proprietary [a586f93]
- Bump version to 0.12.0 [6428571]

## [0.11.0] - 2026-02-03

### Added
- Lessons learned for VS Code pre-release versioning [7b84372]

### Changed
- Sync package-lock.json with version update [f49b2da]

### Fixed
- Use unique package versions for RC releases [86c3afb]

## [0.10.0] - 2026-02-03

### Added
- Release candidate preparation workflow [1e40e0d]

### Changed
- Transform RC versions for VS Code Marketplace compatibility [5ff1a43]
- Reduce cyclomatic complexity in debug adapter and script console [3ef54ab]

## [0.1.0] - 2026-02-03

### Added
- Initial release of Flint for Ignition
- Project Browser with hierarchical tree view
- Support for multiple gateways and projects
- Resource CRUD operations (create, read, update, delete)
- Resource search and content search functionality
- Support for Python Scripts, Named Queries, and Perspective resources
- Gateway and environment management
- Integration with Kindling for backup file viewing
- Integration with Designer Launcher (8.3+)
- Configuration validation and migration
- Resource.json validation and generation
- Search history management
- Status bar indicators for gateway and environment
- Resource templates for quick creation

### Fixed
- Linting errors throughout codebase
- TypeScript strict mode compliance

### Known Issues
- Project script autocomplete not working with nested inheritance
- Project script outlines not yet implemented
- Embedded script decoding in JSON files not implemented
- Gateway REST API integration for project scanning not complete
- No test coverage for most services (basic tests for ServiceContainer only)

## [0.0.1-SNAPSHOT] - 2024-01-10

Initial development version.

### Added
- Pre-release version for testing and feedback
- Core architecture and service infrastructure
- Basic functionality for resource browsing and management

---

## Version History Guide

### Version Numbering
- **Major** (X.0.0): Breaking changes, major feature additions
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, minor improvements

### Release Types
- **SNAPSHOT**: Development builds, not for production
- **ALPHA**: Early testing, may have significant issues
- **BETA**: Feature complete, testing for stability
- **RC**: Release candidate, final testing
- **RELEASE**: Stable production version

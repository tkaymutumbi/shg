# Changelog

All notable changes to `shg-cli` will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [2026.2.0] - 2026-03-01

### Added
- CLI version output via `shg --version` and `shg -v`.
- CLI help output via `shg --help` and `shg -h`, including version and flag details.
- Subcommand mode: `doctor`, `deploy`, `setup`, `run`, `devices`, `config`.
- `doctor` checks with optional safe auto-fix (`--fix`) and JSON output.
- Config system with precedence: flags > local `.shgrc.json` > global config.
- Runtime state persistence in `.shg/state.json` for last device/variant/flavor.
- Device listing command (`shg devices`) with JSON output.
- Smart deploy pipeline with deterministic failure handling.
- Interactive mode refactored to use shared command handlers.

### Changed
- Package version bumped to `2026.2.0`.
- Author metadata now lists SHG, developer T-kay Tinotenda Mutumbiwenzou, and SHG as a sub-company of Xalo Software.
- CLI version now resolves from `package.json` so display stays in sync.

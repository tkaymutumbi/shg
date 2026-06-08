# Changelog

All notable changes to `shg-cli` will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [2026.4.0] - 2026-06-08

### Added
- **9 new commands**: `dev`, `logs`, `plugin`, `open`, `build`, `clean`, `assets`, `bump`, `upgrade`
- **Interactive TUI** now includes all new commands with guided prompts
- **Live reload development** (`shg dev`) launches dev server + Android app with `--livereload`
- **Logcat viewer** (`shg logs`) with tag/level filtering
- **Plugin manager** (`shg plugin add/list/sync`)
- **Standalone build** (`shg build`) supports debug and release variants
- **Version bump** (`shg bump`) syncs `versionName`/`versionCode` across config and Gradle
- **Project cleaner** (`shg clean`) removes build artifacts
- **Asset generator** (`shg assets`) wraps `capacitor-assets`
- **Open in Android Studio** (`shg open`)
- **Upgrade helper** (`shg upgrade`) checks and runs `cap upgrade`
- **Doctor enhancements**: Gradle version check, Android SDK path validation
- **Agent docs**: Auto-generates `.shg/AGENTS.md` when running inside a Capacitor project
- **MIT LICENSE** file
- **CONTRIBUTING.md** with development and release guidelines
- **README** overhaul with ASCII art banner, badges, and full command reference

### Changed
- Migrated from npm to Bun (all commands now use `bun`, `bunx`, `bun add`, `bun pm ls`)
- Switched lockfile from `package-lock.json` to `bun.lock`
- Package version bumped to `2026.4.0`

## [2026.3.0] - 2026-03-01

### Added
- New production bundle command: `shg bundle` with `--aab`, `--apk`, and `--both`.
- Production artifact discovery and output reporting for generated `.aab` / `.apk` files.
- Post-build navigation helpers that print artifact directory and copy-paste `cd` command.

### Changed
- Package version bumped to `2026.3.0`.

## [2026.2.0] - 2026-03-01

### Added
- CLI version output via `shg --version` and `shg -v`.
- CLI help output via `shg --help` and `shg -h`, including version and flag details.
- Subcommand mode: `doctor`, `deploy`, `setup`, `run`, `bundle`, `devices`, `config`.
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

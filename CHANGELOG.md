# Changelog

All notable changes to `shg-cli` will be documented in this file.

The format is based on Keep a Changelog, and this project follows Semantic Versioning.

## [2026.4.1] - 2026-06-09

### Fixed
- **shg dev --wifi**: remembers device IP across reboots via `~/.shg/wifi-state.json`
- **shg dev**: properly checks for `index.html` in webDir before running, not just the directory
- **shg dev**: clearer error when web build produces no output

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

### Fixed
- Auto-detects Android SDK from common paths when `ANDROID_SDK_ROOT` unset
- Falls back to locating SDK via `sdkmanager`, `avdmanager`, or `adb` on PATH
- `shg dev` now checks web assets directory exists and auto-builds if missing
- `shg dev` checks for connected device before launching, gives clear error
- `shg dev --wifi` connects wirelessly (USB first time, then cable-free)
- `shg dev` auto-installs platform-tools (adb) if not found on PATH
- `shg doctor` reports web assets status and scans for SDK in common locations
- Executor now supports custom environment variables for subprocesses

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

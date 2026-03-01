# SHG CLI

Interactive and automation-first CLI for Capacitor Android workflows.

## Install

```bash
npm install -g shg-cli
```

Local dev install:

```bash
cd /home/diplov/shg/shg-cli
npm install
npm run build
npm link
```

## Quick Usage

Interactive mode:

```bash
shg
```

Non-interactive mode:

```bash
shg doctor
shg deploy --all
shg setup --install --add-android
shg run --device emulator-5554 --variant debug
shg devices --json
```

Global flags:

```bash
shg --help
shg --version
```

## Commands

### `shg doctor [--fix] [--json] [--verbose]`
Runs environment and project diagnostics.

Checks include:
- Node/npm
- Java
- adb
- Android SDK env vars
- Capacitor project detection
- Android platform folder
- Capacitor dependencies

`--fix` policy:
- Applies safe fixes only (for example dependency install)
- Prints manual guidance for system-level fixes

### `shg deploy [--all | --build | --sync | --run] [--device <id>] [--variant <name>] [--flavor <name>]`
Smart deploy flow. `--all` runs build -> sync -> run.

Behavior:
- Auto-runs `doctor` before deploy when enabled in config
- Stops on first failed step
- Supports device/variant/flavor targeting for run step

### `shg setup [--install] [--init] [--update] [--add-android]`
Runs setup tasks in deterministic order:
1. install
2. init
3. update
4. add-android

### `shg run [--device <id>] [--variant <name>] [--flavor <name>]`
Runs `cap run android` with optional targeting and remembers last successful device/variant/flavor in `.shg/state.json`.

### `shg devices [--json]`
Lists devices from `adb devices -l`.

### `shg config [list|get|set|path]`
Reads and updates SHG config.

Examples:

```bash
shg config list
shg config get defaultVariant
shg config set defaultVariant release
shg config set output.verbose true --global
shg config path
shg config path --global
```

## Config

Precedence order:
1. CLI flags
2. Local project config (`.shgrc.json`)
3. Global config (`~/.config/shg/config.json` on Linux/macOS)
4. Built-in defaults

Example `.shgrc.json`:

```json
{
  "defaultFlow": "deployAll",
  "defaultDeviceId": "",
  "defaultVariant": "debug",
  "defaultFlavor": "",
  "autoSyncBeforeRun": true,
  "doctor": {
    "autoRunBeforeDeploy": true,
    "allowSafeFixes": false
  },
  "output": {
    "verbose": false,
    "json": false
  }
}
```

## Local Update / Retest

```bash
cd /home/diplov/shg/shg-cli
npm install
npm run build
npm link
hash -r
which shg
shg --version
shg --help
```

If `npm link` fails in your environment:

```bash
cd /home/diplov/shg/shg-cli
npm install -g .
hash -r
```

## Quality Checks

```bash
npm run typecheck
npm run build
```

## Changelog

Release notes are tracked in `CHANGELOG.md`.

## Author

- Author: SHG
- Developer: T-kay Tinotenda Mutumbiwenzou
- Company context: SHG is a sub-company of Xalo Software.

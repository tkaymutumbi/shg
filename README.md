```
███████╗██╗  ██╗ ██████╗ 
██╔════╝██║  ██║██╔════╝ 
███████╗███████║██║  ███╗
╚════██║██╔══██║██║   ██║
███████║██║  ██║╚██████╔╝
╚══════╝╚═╝  ╚═╝ ╚═════╝ 
```

<p align="center">
  <strong>Interactive & automation-first CLI for Capacitor Android development</strong>
</p>

<p align="center">
  <a href="https://github.com/Diplovee/shg/releases"><img src="https://img.shields.io/github/v/release/Diplovee/shg?style=flat&label=version" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Diplovee/shg?style=flat" alt="License"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/bun-1.3%2B-%23ffffff?style=flat&logo=bun" alt="Bun"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-18%2B-339933?style=flat&logo=node.js" alt="Node"></a>
  <a href="https://github.com/Diplovee/shg/issues"><img src="https://img.shields.io/github/issues-raw/Diplovee/shg?style=flat" alt="Issues"></a>
  <a href="https://github.com/Diplovee/shg/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat" alt="PRs"></a>
</p>

<p align="center">
  <a href="web/"><strong>📖 Documentation Website</strong></a>
</p>

---

SHG streamlines every Capacitor Android workflow — from project setup and live-reload development to building signed APKs and bumping versions — so you spend less time on CLI incantations and more time building your app.

The project also includes a [documentation website](web/) (React + Vite) with full docs, command reference, and a searchable interface.

## Features

- **Interactive TUI** — Launch `shg` with no arguments to get a menu-driven interface
- **Live Reload** — Start a dev server and Android app together with `shg dev`
- **WiFi Debugging** — Run `shg dev --wifi` to deploy and hot-reload wirelessly
- **Interactive Dev Prompting** — Pick Auto, WiFi, or USB/Emulator from the interactive dev flow
- **Auto-Install adb** — Downloads platform-tools automatically if adb is missing
- **Smart Deploy** — Build → sync → run in one command with failure safety
- **Project Setup** — Install Capacitor, init, update, and add the Android platform
- **Build APK/AAB** — Debug or release builds via Gradle, no Android Studio needed
- **Plugin Management** — Add, list, and sync Capacitor plugins
- **Diagnostics** — Check Node, Java, adb, Android SDK, Gradle, Capacitor deps, and Java target mismatches
- **Device Management** — List ADB devices with model info
- **Logcat Viewer** — Tail filtered Android logs with `shg logs`
- **Asset Generation** — Generate icons and splash screens via capacitor-assets
- **Version Bumping** — Bump `versionName`/`versionCode` across configs and Gradle
- **Upgrade Helper** — Check and upgrade Capacitor packages
- **Clean Builds** — Remove build artifacts with one command
- **Config System** — Global + per-project config with CLI flag overrides
- **JSON Output** — Machine-readable output for CI integration

## Installation

```bash
# Global install (recommended)
bun install -g shg-cli

# Or from source
git clone https://github.com/Diplovee/shg.git
cd shg
bun install
bun run build
bun link
```

### Prerequisites

- [Bun](https://bun.sh) 1.3+ or [Node.js](https://nodejs.org) 18+
- [Java JDK](https://adoptium.net) 17+ (for Android builds)
- [Android SDK](https://developer.android.com/studio) with `ANDROID_HOME` or `ANDROID_SDK_ROOT` set
- `adb` available on PATH

## Quick Start

```bash
# Launch the interactive menu
shg

# Or jump straight to a command
shg doctor --fix
shg setup --install --add-android
shg dev --host 0.0.0.0              # Live reload over USB
shg dev --wifi                       # Live reload over WiFi
shg deploy --all --device emulator-5554
```

## Interactive Mode

Running `shg` with no arguments opens the interactive TUI:

```
┌─────────────────────────────────────────────┐
│  SHG CLI Interactive                        │
├─────────────────────────────────────────────┤
│  What do you want to do?                    │
│                                             │
│  ○ Dev Server (Live Reload)                 │
│  ○ Build & Deploy                           │
│  ○ Capacitor Setup                          │
│  ○ Build APK/AAB                            │
│  ○ View Logs                                │
│  ○ Plugin Manager                           │
│  ○ Assets (Icons/Splash)                    │
│  ○ Open in Android Studio                   │
│  ○ Clean Project                            │
│  ○ Check Upgrades                           │
└─────────────────────────────────────────────┘
```

Each selection walks you through the necessary prompts — no flags to remember. The Dev flow now lets you choose Auto, WiFi, or USB/Emulator mode and set the port/host interactively.

## Command Reference

### `shg dev`

Start a live-reload dev server and launch the Android app. Auto-installs `adb` if missing, auto-builds web assets if the output directory is empty, and detects the Android SDK even when `ANDROID_SDK_ROOT` isn't set.

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `localhost`/auto | Dev server host |
| `--port` | `5173` | Dev server port |
| `--wifi` | — | Connect to device over WiFi instead of USB |
| `--skip-build` | — | Skip auto-build if web assets directory is missing |

**First connection (USB required):**

```bash
# Connect device via USB, then run:
shg dev
```

**After USB authorization (cable-free):**

```bash
shg dev --wifi
```

SHG auto-detects the active wireless ADB target with mDNS. If the phone restarted and Android changed its wireless debugging port, SHG offers pairing-code recovery, detected connect ports, or manual entry of the exact connect IP:port shown by Android.

**Custom dev server:**

```bash
shg dev --host 0.0.0.0 --port 5173
```

> Once running, the app hot-reloads on every file save — no need to re-run the command.

### `shg doctor`

Run environment and project diagnostics, including Capacitor package-major alignment and Android Java target vs installed JDK checks.

| Flag | Description |
|------|-------------|
| `--fix` | Apply safe auto-fixes |
| `--json` | JSON output |
| `--verbose` | Verbose output |

```bash
shg doctor
shg doctor --fix
shg doctor --json
```

### `shg deploy`

Smart deploy pipeline: build → sync → run.

| Flag | Description |
|------|-------------|
| `--all` | Full pipeline (default if no step selected) |
| `--build` | Build only |
| `--sync` | Sync only |
| `--run` | Run only |
| `--device <id>` | Target device |
| `--variant <name>` | Build variant (e.g. `debug`, `release`) |
| `--flavor <name>` | Build flavor |

```bash
shg deploy --all
shg deploy --build --sync
shg deploy --run --device emulator-5554 --variant release
```

### `shg setup`

Install Capacitor, initialize, update, and add the Android platform.

| Flag | Description |
|------|-------------|
| `--install` | Install `@capacitor/core` and `@capacitor/cli` |
| `--init` | Run `cap init` |
| `--update` | Run `cap update` |
| `--add-android` | Add the Android platform |

```bash
shg setup --install --add-android
shg setup --install --init --update --add-android
```

### `shg run`

Run the Android app with targeting options.

| Flag | Description |
|------|-------------|
| `--device <id>` | Target device |
| `--variant <name>` | Build variant |
| `--flavor <name>` | Build flavor |

```bash
shg run --device emulator-5554 --variant debug
```

The last successful device, variant, and flavor are saved to `.shg/state.json`.

### `shg build`

Build a standalone APK/AAB. Automatically syncs web assets to the Android project before building (skip with `--no-sync`).

| Flag | Description |
|------|-------------|
| `--release` | Build release variant |
| `--variant <name>` | Build variant (default `debug`) |
| `--flavor <name>` | Build flavor |
| `--no-sync` | Skip web build and cap sync before Gradle |

```bash
shg build
shg build --release
shg build --variant release --no-sync   # If you synced manually already
```

### `shg clean`

Remove build artifacts and caches.

```bash
shg clean
```

### `shg devices`

List connected Android devices from ADB.

| Flag | Description |
|------|-------------|
| `--json` | JSON output |

```bash
shg devices
shg devices --json
```

### `shg logs`

Tail logcat with Capacitor filter.

| Flag | Default | Description |
|------|---------|-------------|
| `--tag` | `Capacitor` | Logcat tag filter |
| `--level` | `D` | Log level (D, I, W, E) |

```bash
shg logs
shg logs --tag Capacitor --level E
```

### `shg plugin`

Manage Capacitor plugins.

```bash
shg plugin list
shg plugin add @capacitor/camera
shg plugin sync
```

### `shg assets`

Generate app icons and splash screens via `capacitor-assets`.

```bash
shg assets
```

### `shg open`

Open the project in Android Studio.

| Flag | Default | Description |
|------|---------|-------------|
| `--platform` | `android` | Platform to open |

```bash
shg open
```

### `shg bump`

Bump `versionName` and `versionCode` in `capacitor.config.*` and `android/app/build.gradle`.

| Flag | Description |
|------|-------------|
| `--to <version>` | Set specific version (e.g. `2026.5.0`) |
| (none) | Auto-increment `versionCode` by 1 |

```bash
shg bump
shg bump --to 2026.5.0
```

### `shg upgrade`

Check and upgrade Capacitor packages.

| Flag | Description |
|------|-------------|
| `--run` | Perform the upgrade |

```bash
shg upgrade
shg upgrade --run
```

### `shg config`

Read and update SHG configuration.

```bash
shg config list
shg config get defaultVariant
shg config set defaultVariant release
shg config set output.verbose true --global
shg config path
```

## Configuration

Configuration is resolved with the following precedence (highest wins):

1. **CLI flags**
2. **Local project config** — `.shgrc.json` in your project root
3. **Global config** — `~/.config/shg/config.json` (Linux/macOS) or `%APPDATA%/shg/config.json` (Windows)
4. **Built-in defaults**

### Example `.shgrc.json`

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

### Global flags

| Flag | Description |
|------|-------------|
| `-h, --help` | Show help |
| `-v, --version` | Show version |
| `--verbose` | Verbose command output |
| `--json` | JSON output where supported |

## Development

```bash
git clone https://github.com/Diplovee/shg.git
cd shg
bun install
bun run build
bun link
```

### Scripts

| Script | Description |
|--------|-------------|
| `bun run build` | Compile TypeScript |
| `bun run typecheck` | Type-check without emitting |
| `bun run smoke` | Type-check + build |
| `bun src/index.ts` | Run from source |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — SHG (Sub-company of Xalo Software) — T-kay Tinotenda Mutumbiwenzou

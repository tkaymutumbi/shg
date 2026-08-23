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

SHG streamlines every Capacitor Android workflow — from project setup and bundled debug verification to optional live-reload development, signed APKs, and version bumps — so you spend less time on CLI incantations and more time building your app.

The project also includes a [documentation website](web/) (React + Vite) with full docs, command reference, and a searchable interface.

## Features

- **Interactive TUI** — Launch `shg` with no arguments to get a menu-driven interface
- **Bundled Verification** — Build and launch a self-contained debug app with `shg build && shg run`
- **Optional Live Reload** — Start a Vite server and Android app together with `shg dev`; use `shg dev --wifi` for focused wireless UI work
- **Interactive Dev Prompting** — Pick Auto, WiFi, or USB/Emulator from the interactive dev flow
- **Auto-Install adb** — Downloads platform-tools automatically if adb is missing
- **Smart Deploy** — Build → sync → run in one command with failure safety
- **Project Setup** — Install Capacitor, init, update, and add the Android platform
- **Build APK/AAB** — Debug or release builds via Gradle, no Android Studio needed
- **Plugin Management** — Add, list, and sync Capacitor plugins
- **Diagnostics** — Check Node, Java, adb, Android SDK, Gradle, Capacitor deps, and Java target mismatches
- **Device Management** — List ADB devices with model info
- **Logcat Viewer** — Tail filtered Android logs with `shg logs`
- **Asset Generation** — Validate project icon sources and generate Android icons/splash screens via `@capacitor/assets`
- **Version Bumping** — Bump `versionName`/`versionCode` in JSON config and Android Gradle files
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

- [Bun](https://bun.sh) 1.3+ (required by SHG's project workflow commands)
- [Node.js](https://nodejs.org) 18+ (required to run the compiled CLI; Bun is still needed for the wrapped project commands)
- [Java JDK](https://adoptium.net) 17+ (for Android builds)
- [Android SDK](https://developer.android.com/studio) with `ANDROID_HOME` or `ANDROID_SDK_ROOT` set
- `adb` available on PATH

### Windows

SHG uses the Android Gradle wrapper (`android\gradlew.bat`) and PowerShell for its Windows platform-tools extraction path. Install Bun, Java 17+, and Android Studio with the Android SDK and platform-tools components. SHG can download a private copy of `adb.exe` when it is missing; the bundled tool is added to the current SHG process automatically. Add `%USERPROFILE%\.shg\bin` to your user `PATH` if you want that copy available in future terminals.

## Quick Start

```bash
# Launch the interactive menu
shg

# Or jump straight to a command
shg doctor --fix
shg setup --install --add-android
shg build                            # Bundled debug APK
shg run                              # Install and launch it
shg dev --wifi --host <LAN-IP>       # Optional live reload
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

Each selection walks you through the necessary prompts — no flags to remember. Use Build & Deploy for the normal bundled verification path; the Dev flow is optional live reload and lets you choose WiFi or USB/Emulator mode and set the port/host interactively.

## Command Reference

### `shg dev`

Start an optional Vite live-reload server and launch the Android app. Auto-installs `adb` if missing, auto-builds web assets if the output directory is empty, checks the selected host/port and Capacitor config, and detects the Android SDK even when `ANDROID_SDK_ROOT` isn't set. For normal testing use `shg build` followed by `shg run`.

| Flag | Default | Description |
|------|---------|-------------|
| `--host` | `localhost`/auto | Dev server host |
| `--port` | `5173` | Dev server port |
| `--wifi` | — | Connect to device over WiFi for optional live reload |
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

The device IP is auto-detected for USB-authorized devices. If no device is found, enter either a legacy IP address (port 5555 is assumed) or the full `IP:port` shown by Android's Wireless debugging screen. SHG can also run Android's six-digit `adb pair` flow, retries while adbd restarts, and verifies that the device reaches the ready state before reporting success.

**Custom dev server:**

```bash
shg dev --host 0.0.0.0 --port 5173
```

> Once running, the app hot-reloads on every file save — no need to re-run the command. WiFi mode passes the exact connected ADB `IP:port` to Capacitor with `--target`; if the screen is blank, follow SHG's printed `adb`, logcat, and screenshot diagnostics.

### `shg screenshot`

Capture a temporary PNG from the selected Android device for visual inspection. The default output is outside the project; inspect the printed path with `view_image` and do not commit it.

```bash
shg screenshot
shg screenshot --device 192.168.1.179:44893
shg screenshot --output /tmp/battery-screen.png
```

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

`--json` is non-interactive and cannot be combined with `--fix`.

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
| `--aab` | Build an Android App Bundle instead of an APK |
| `--both` | Build both APK and AAB artifacts |
| `--no-sync` | Skip web build and cap sync before Gradle |

```bash
shg build
shg build --release
shg build --release --aab
shg build --release --both
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
| `--wifi` | Connect or pair over WiFi before listing devices |

```bash
shg devices
shg devices --json
shg devices --wifi
```

WiFi setup is interactive, so `--wifi` cannot be combined with `--json`.

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

Validate an icon source and generate Android app icons and splash screens via `@capacitor/assets`. SHG accepts `assets/icon.(svg|png|jpg)` or copies a valid `public/icon.(svg|png|jpg)` into `assets/`.

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

Bump `versionName` and `versionCode` in `capacitor.config.json` and Android Groovy/Kotlin Gradle files. JavaScript/TypeScript configs are read but not rewritten, avoiding unsafe source-code mutation.

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

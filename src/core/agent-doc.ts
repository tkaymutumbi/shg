import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_VERSION } from "./version.js";

const ROOT_SECTION_START = "<!-- shg-agent-instructions:start -->";
const ROOT_SECTION_END = "<!-- shg-agent-instructions:end -->";

const ROOT_SECTION = `${ROOT_SECTION_START}
## SHG Android workflow

When the user asks to use SHG, run an Android app, connect a phone, use Wi-Fi debugging, build an APK/AAB, or work with Capacitor, read and follow [the SHG agent playbook](.shg/AGENTS.md) before acting.
${ROOT_SECTION_END}`;

const AGENTS_MD = `# SHG CLI — Agent Playbook

**Version:** ${CLI_VERSION}

Use this guide whenever the user asks to use SHG in this project. SHG streamlines Capacitor Android setup, diagnostics, device connections, live reload, builds, deployment, logs, assets, and version management.

## How to help the user

1. Work from the project root. Inspect \`package.json\`, the Capacitor config, and \`android/\` before choosing commands.
2. Run \`shg doctor\` early and use its concrete fixes. Do not hide failed checks.
3. If this is not a Capacitor project yet, initialize it without replacing the existing web app:
   - \`shg setup --install\`
   - \`bunx cap init "<app name>" <reverse.domain.appid> --web-dir <build-directory>\`
   - \`bun add @capacitor/android\`
   - \`bunx cap add android\`
4. Prefer \`shg dev --wifi\` for Wi-Fi live reload and \`shg dev\` for USB/emulators.
5. Use \`shg devices --wifi\` to connect or pair a phone. For Android 11+, guide the user to Developer options → Wireless debugging; the pairing address and connection address can use different ports.
6. Use \`shg build\` for a debug APK, \`shg build --release\` for a release APK, and \`shg build --release --aab\` for a Play Store bundle.
7. Preserve the user's source files and existing project instructions. Ask before changing signing credentials, app IDs, or release configuration.
8. If the user asks for an interactive workflow, run plain \`shg\` in a real TTY and help them choose the appropriate menu item.

## Commands

| Command | Description |
|---------|-------------|
| \`shg\` | Launch interactive mode (default) |
| \`shg dev\` | Start live reload dev server + Android app |
| \`shg doctor\` | Run environment and project diagnostics |
| \`shg deploy\` | Build/sync/run flows |
| \`shg setup\` | Setup Capacitor dependencies and Android platform |
| \`shg run\` | Run Android app with optional device targeting |
| \`shg build\` | Build APK/AAB (debug or release) |
| \`shg clean\` | Clean project build artifacts |
| \`shg devices\` | List devices or connect/pair over WiFi with \`--wifi\` |
| \`shg logs\` | Tail logcat with Capacitor filter |
| \`shg plugin\` | Add/list/sync Capacitor plugins |
| \`shg assets\` | Generate app icons and splash screens |
| \`shg open\` | Open project in Android Studio |
| \`shg bump\` | Bump versionName/versionCode |
| \`shg upgrade\` | Check/upgrade Capacitor packages |
| \`shg create\` | Scaffold a new app (React, Vue, Angular, etc.) with optional Capacitor + Android |
| \`shg config\` | Read or update SHG configuration |

## Common Flags

| Flag | Description |
|------|-------------|
| \`-h, --help\` | Show help |
| \`-v, --version\` | Show version |
| \`--verbose\` | Verbose command output |
| \`--json\` | JSON output where supported |

## Configuration

SHG reads config from (in order):
1. Defaults
2. Global config: \`~/.config/shg/config.json\`
3. Project config: \`<project>/.shgrc.json\`

## Typical Workflows

\`\`\`bash
# Live reload development
shg dev --host 0.0.0.0 --port 5173
shg dev --wifi                   # Wireless live reload

# Full deploy pipeline
shg deploy --all --device emulator-5554 --variant debug

# Setup an existing Capacitor project
shg setup --install --add-android

# Diagnostics
shg doctor --fix

# Build release APK or AAB
shg build --release
shg build --release --aab

# View logs
shg logs --tag Capacitor --level D

# Generate assets
shg assets

# Bump version
shg bump --to 2026.4.0

# Launch interactive mode
shg
\`\`\`
`;

export function ensureAgentDoc(projectRoot: string): void {
  const dir = join(projectRoot, ".shg");
  const playbookFile = join(dir, "AGENTS.md");
  const rootFile = join(projectRoot, "AGENTS.md");

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(playbookFile, AGENTS_MD, "utf-8");

  const existing = existsSync(rootFile) ? readFileSync(rootFile, "utf-8") : "";
  const managedPattern = new RegExp(`${ROOT_SECTION_START}[\\s\\S]*?${ROOT_SECTION_END}`, "m");
  const updated = managedPattern.test(existing)
    ? existing.replace(managedPattern, ROOT_SECTION)
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${ROOT_SECTION}\n`;

  if (updated !== existing) {
    writeFileSync(rootFile, updated, "utf-8");
  }
}

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLI_VERSION } from "./version.js";

const AGENTS_MD = `# SHG CLI — Capacitor Android Development Tool

**Version:** ${CLI_VERSION}

SHG is a CLI tool that streamlines Capacitor Android development: building, syncing, deploying, live reload, logging, asset generation, and version management.

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
| \`shg devices\` | List connected Android devices from ADB |
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

# Quick setup
shg setup --install --add-android

# Diagnostics
shg doctor --fix

# Build release APK
shg build --release

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
  const file = join(dir, "AGENTS.md");

  if (!existsSync(file)) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(file, AGENTS_MD, "utf-8");
  }
}

#!/usr/bin/env node

import chalk from "chalk";
import figlet from "figlet";
import type { CommandContext, CommandResult } from "./commands/types.js";
import { runAssets } from "./commands/assets.js";
import { runBuild } from "./commands/build.js";
import { runBump } from "./commands/bump.js";
import { runClean } from "./commands/clean.js";
import { runConfig } from "./commands/config.js";
import { runCreate } from "./commands/create.js";
import { runDeploy } from "./commands/deploy.js";
import { runDev } from "./commands/dev.js";
import { runDevices } from "./commands/devices.js";
import { runDoctor } from "./commands/doctor.js";
import { runLogs } from "./commands/logs.js";
import { runOpen } from "./commands/open.js";
import { runPlugin } from "./commands/plugin.js";
import { runRun } from "./commands/run.js";
import { runSetup } from "./commands/setup.js";
import { runUpgrade } from "./commands/upgrade.js";
import { parseArgs } from "./core/args.js";
import { loadMergedConfig } from "./core/config.js";
import { findProjectRoot, findAndroidSdkRoot } from "./core/project.js";
import { CLI_VERSION } from "./core/version.js";
import { runInteractive } from "./interactive.js";
import { ensureAgentDoc } from "./core/agent-doc.js";

type CommandHandler = (context: CommandContext, rest: string[]) => Promise<CommandResult>;

const COMMAND_REGISTRY: Record<string, CommandHandler> = {
  assets: (ctx) => runAssets(ctx),
  build: (ctx) => runBuild(ctx),
  bump: (ctx) => runBump(ctx),
  clean: (ctx) => runClean(ctx),
  config: (ctx, rest) => runConfig(ctx, rest),
  create: (ctx, rest) => runCreate(ctx, rest),
  deploy: (ctx) => runDeploy(ctx),
  dev: (ctx) => runDev(ctx),
  devices: (ctx) => runDevices(ctx),
  doctor: (ctx) => runDoctor(ctx),
  logs: (ctx) => runLogs(ctx),
  open: (ctx) => runOpen(ctx),
  plugin: (ctx, rest) => runPlugin(ctx, rest),
  run: (ctx) => runRun(ctx),
  setup: (ctx) => runSetup(ctx),
  upgrade: (ctx) => runUpgrade(ctx),
};

const ascii = figlet.textSync("SHG", {
  font: "ANSI Shadow",
  horizontalLayout: "fitted",
});

function printBanner(): void {
  console.log("\n" + chalk.cyan(ascii));
  console.log(chalk.dim(`  Capacitor Android CLI - by SHG (v${CLI_VERSION})\n`));
}

function printHelp(): void {
  console.log(`SHG CLI ${CLI_VERSION}

Usage:
  shg
  shg <command> [flags]

Commands:
  dev                     Live reload dev server + Android app
  doctor                  Run environment and project diagnostics
  deploy                  Build/sync/run flows
  setup                   Setup capacitor dependencies and platform
  run                     Run Android app with optional targeting
  build                   Build APK/AAB (debug/release; use --aab or --both)
  clean                   Clean project build artifacts
  devices                 List devices or connect over WiFi with --wifi
  logs                    Tail logcat with Capacitor filter
  plugin                  Add/list/sync Capacitor plugins
  assets                  Generate app icons and splash screens
  open                    Open project in Android Studio
  create                  Scaffold a new app (React, Vue, Angular, etc.)
  bump                    Bump versionName/versionCode
  upgrade                 Check/upgrade Capacitor packages
  config                  Read or update SHG config

Examples:
  shg dev --host 0.0.0.0 --port 5173
  shg dev --wifi                       Wireless live reload
  shg doctor --fix
  shg deploy --all --device emulator-5554 --variant debug
  shg setup --install --add-android
  shg run --device emulator-5554
  shg build --release
  shg build --release --aab
  shg clean
  shg devices --json
  shg logs --tag Capacitor --level D
  shg plugin add @capacitor/camera
  shg assets
  shg open
  shg create my-app                    Scaffold new app interactively
  shg bump --to 2026.4.0
  shg upgrade --run
  shg config set defaultVariant release

Global Flags:
  -h, --help              Show help
  -v, --version           Show version
      --verbose           Verbose command output
      --json              JSON output where supported
`);
}

function makeContext(flags: Record<string, string | boolean>): CommandContext {
  const projectRoot = findProjectRoot(process.cwd());
  const loaded = loadMergedConfig(projectRoot);

  if (projectRoot) {
    ensureAgentDoc(projectRoot);
  }

  return {
    projectRoot,
    config: {
      ...loaded.config,
      output: {
        ...loaded.config.output,
        verbose: Boolean(flags.verbose || loaded.config.output.verbose),
        json: Boolean(flags.json || loaded.config.output.json),
      },
    },
    verbose: Boolean(flags.verbose || loaded.config.output.verbose),
    json: Boolean(flags.json || loaded.config.output.json),
    flags,
  };
}

function ensureAndroidSdkEnv(): void {
  if (process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME) return;
  const found = findAndroidSdkRoot();
  if (found) {
    process.env.ANDROID_SDK_ROOT = found;
    process.env.ANDROID_HOME = found;
  }
}

async function main(): Promise<void> {
  ensureAndroidSdkEnv();
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.errors.length > 0) {
    for (const error of parsed.errors) {
      console.error(chalk.red(error));
    }
    printHelp();
    process.exit(2);
  }

  if (parsed.version) {
    console.log(CLI_VERSION);
    process.exit(0);
  }

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  const context = makeContext(parsed.flags);

  if (!parsed.command) {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.error(chalk.red("Non-interactive terminal detected. Use a subcommand, e.g. `shg doctor`."));
      process.exit(2);
    }

    printBanner();
    const code = await runInteractive(context);
    process.exit(code);
  }

  const handler = COMMAND_REGISTRY[parsed.command];
  if (handler) {
    const result = await handler(context, parsed.rest);
    process.exit(result.exitCode);
  }

  process.exit(0);
}

void main();

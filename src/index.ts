#!/usr/bin/env node

import chalk from "chalk";
import figlet from "figlet";
import { runAssets } from "./commands/assets.js";
import { runBuild } from "./commands/build.js";
import { runBump } from "./commands/bump.js";
import { runClean } from "./commands/clean.js";
import { runConfig } from "./commands/config.js";
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
import type { CommandContext } from "./commands/types.js";
import { parseArgs } from "./core/args.js";
import { loadMergedConfig } from "./core/config.js";
import { findProjectRoot } from "./core/project.js";
import { CLI_VERSION } from "./core/version.js";
import { runInteractive } from "./interactive.js";
import { ensureAgentDoc } from "./core/agent-doc.js";

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
  build                   Build APK/AAB (debug/release)
  clean                   Clean project build artifacts
  devices                 List Android devices from adb
  logs                    Tail logcat with Capacitor filter
  plugin                  Add/list/sync Capacitor plugins
  assets                  Generate app icons and splash screens
  open                    Open project in Android Studio
  bump                    Bump versionName/versionCode
  upgrade                 Check/upgrade Capacitor packages
  config                  Read or update SHG config

Examples:
  shg dev --host 0.0.0.0 --port 5173
  shg doctor --fix
  shg deploy --all --device emulator-5554 --variant debug
  shg setup --install --add-android
  shg run --device emulator-5554
  shg build --release
  shg clean
  shg devices --json
  shg logs --tag Capacitor --level D
  shg plugin add @capacitor/camera
  shg assets
  shg open
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

async function main(): Promise<void> {
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

  let exitCode = 0;
  if (parsed.command === "doctor") {
    exitCode = (await runDoctor(context)).exitCode;
  } else if (parsed.command === "deploy") {
    exitCode = (await runDeploy(context)).exitCode;
  } else if (parsed.command === "setup") {
    exitCode = (await runSetup(context)).exitCode;
  } else if (parsed.command === "run") {
    exitCode = (await runRun(context)).exitCode;
  } else if (parsed.command === "devices") {
    exitCode = (await runDevices(context)).exitCode;
  } else if (parsed.command === "config") {
    exitCode = (await runConfig(context, parsed.rest)).exitCode;
  } else if (parsed.command === "dev") {
    exitCode = (await runDev(context)).exitCode;
  } else if (parsed.command === "logs") {
    exitCode = (await runLogs(context)).exitCode;
  } else if (parsed.command === "plugin") {
    exitCode = (await runPlugin(context, parsed.rest)).exitCode;
  } else if (parsed.command === "open") {
    exitCode = (await runOpen(context)).exitCode;
  } else if (parsed.command === "build") {
    exitCode = (await runBuild(context)).exitCode;
  } else if (parsed.command === "clean") {
    exitCode = (await runClean(context)).exitCode;
  } else if (parsed.command === "assets") {
    exitCode = (await runAssets(context)).exitCode;
  } else if (parsed.command === "bump") {
    exitCode = (await runBump(context)).exitCode;
  } else if (parsed.command === "upgrade") {
    exitCode = (await runUpgrade(context)).exitCode;
  }

  process.exit(exitCode);
}

void main();

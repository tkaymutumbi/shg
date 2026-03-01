#!/usr/bin/env node

import chalk from "chalk";
import figlet from "figlet";
import { runConfig } from "./commands/config.js";
import { runDeploy } from "./commands/deploy.js";
import { runDevices } from "./commands/devices.js";
import { runDoctor } from "./commands/doctor.js";
import { runRun } from "./commands/run.js";
import { runSetup } from "./commands/setup.js";
import type { CommandContext } from "./commands/types.js";
import { parseArgs } from "./core/args.js";
import { loadMergedConfig } from "./core/config.js";
import { findProjectRoot } from "./core/project.js";
import { CLI_VERSION } from "./core/version.js";
import { runInteractive } from "./interactive.js";

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
  doctor                  Run environment and project diagnostics
  deploy                  Build/sync/run flows
  setup                   Setup capacitor dependencies and platform
  run                     Run Android app with optional targeting
  devices                 List Android devices from adb
  config                  Read or update SHG config

Examples:
  shg doctor --fix
  shg deploy --all --device emulator-5554 --variant debug
  shg setup --install --add-android
  shg run --device emulator-5554
  shg devices --json
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
  }

  process.exit(exitCode);
}

void main();

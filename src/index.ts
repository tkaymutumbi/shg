#!/usr/bin/env node

import * as p from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import { execa } from "execa";
import { existsSync } from "node:fs";

// ── ASCII Art Header ──────────────────────────────────────────────────────────
const ascii = figlet.textSync("SHG", {
  font: "ANSI Shadow",
  horizontalLayout: "fitted",
});

console.log("\n" + chalk.cyan(ascii));
console.log(chalk.dim("  ⚡ Capacitor Android CLI — by SHG\n"));

// ── Command Definitions ───────────────────────────────────────────────────────
const COMMANDS = {
  build:      { label: "npm run build",                              cmd: "npm", args: ["run", "build"], requiresCapProject: false },
  sync:       { label: "npx cap sync android",                       cmd: "npx", args: ["cap", "sync", "android"], requiresCapProject: true },
  run:        { label: "npx cap run android",                        cmd: "npx", args: ["cap", "run", "android"], requiresCapProject: true },
  install:    { label: "npm install @capacitor/core @capacitor/cli", cmd: "npm", args: ["install", "@capacitor/core", "@capacitor/cli"], requiresCapProject: false },
  init:       { label: "npx cap init",                               cmd: "npx", args: ["cap", "init"], requiresCapProject: false },
  update:     { label: "npx cap update",                             cmd: "npx", args: ["cap", "update"], requiresCapProject: true },
  addAndroid: { label: "npx cap add android",                        cmd: "npx", args: ["cap", "add", "android"], requiresCapProject: true },
} as const;

type CommandKey = keyof typeof COMMANDS;

function isCapacitorProject(): boolean {
  return (
    existsSync("capacitor.config.ts") ||
    existsSync("capacitor.config.js") ||
    existsSync("capacitor.config.json")
  );
}

// ── Run a command ─────────────────────────────────────────────────────────────
async function runCommand(key: CommandKey) {
  const { label, cmd, args, requiresCapProject } = COMMANDS[key];
  const s = p.spinner();

  if (requiresCapProject && !isCapacitorProject()) {
    s.stop(
      chalk.red(
        "✘ No Capacitor project found. Run this from a project containing capacitor.config.ts/js/json.",
      ),
    );
    process.exit(1);
  }

  s.start(chalk.yellow(`Running: ${chalk.white(label)}`));
  try {
    await execa(cmd, args, { stdio: "inherit" });
    s.stop(chalk.green(`✔ Done: ${label}`));
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown command failure";
    s.stop(chalk.red(`✘ Failed: ${label}`));
    console.error(chalk.red(`Reason: ${details}`));
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      chalk.red(
        "This CLI requires an interactive terminal (TTY). Run `shg` directly in your terminal.",
      ),
    );
    process.exit(1);
  }

  p.intro(chalk.bgCyan(chalk.black(" SHG CLI ")));

  const category = await p.select({
    message: "What do you want to do?",
    options: [
      { value: "deploy", label: "🚀  Build & Deploy",  hint: "build → sync → run" },
      { value: "setup",  label: "🔧  Capacitor Setup", hint: "install, init, update, add android" },
    ],
  });

  if (p.isCancel(category)) { p.cancel("Cancelled."); process.exit(0); }

  if (category === "deploy") {
    const choice = await p.select({
      message: "Pick a deploy command:",
      options: [
        { value: "all",   label: "⚡ Run ALL",              hint: "build → sync → run" },
        { value: "build", label: "📦 npm run build" },
        { value: "sync",  label: "🔄 npx cap sync android" },
        { value: "run",   label: "▶️  npx cap run android" },
      ],
    });

    if (p.isCancel(choice)) { p.cancel("Cancelled."); process.exit(0); }

    if (choice === "all") {
      await runCommand("build");
      await runCommand("sync");
      await runCommand("run");
    } else {
      await runCommand(choice as CommandKey);
    }
  }

  if (category === "setup") {
    const choice = await p.select({
      message: "Pick a setup command:",
      options: [
        { value: "install",    label: "📥 Install Capacitor", hint: "@capacitor/core @capacitor/cli" },
        { value: "init",       label: "🎬 Cap Init" },
        { value: "update",     label: "⬆️  Cap Update" },
        { value: "addAndroid", label: "🤖 Add Android Platform" },
      ],
    });

    if (p.isCancel(choice)) { p.cancel("Cancelled."); process.exit(0); }
    await runCommand(choice as CommandKey);
  }

  p.outro(chalk.cyan("✨ SHG done. Happy coding!"));
}

main();

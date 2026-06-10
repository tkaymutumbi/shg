import * as p from "@clack/prompts";
import chalk from "chalk";
import { join } from "node:path";
import { runCommand } from "../core/executor.js";
import { readJsonFile, writeJsonFile } from "../core/fsjson.js";
import type { CommandContext, CommandResult } from "./types.js";

interface Framework {
  value: string;
  label: string;
  template: string;
}

const FRAMEWORKS: Framework[] = [
  { value: "react", label: "React + TypeScript", template: "react-ts" },
  { value: "vue", label: "Vue + TypeScript", template: "vue-ts" },
  { value: "svelte", label: "Svelte + TypeScript", template: "svelte-ts" },
  { value: "solid", label: "Solid + TypeScript", template: "solid-ts" },
  { value: "vanilla", label: "Vanilla + TypeScript", template: "vanilla-ts" },
];

const CAPACITOR_SCRIPTS: Record<string, string> = {
  "android:sync": "bunx cap sync android",
  "android:open": "bunx cap open android",
  "android:build": "bunx cap build android",
};

export function formatAppName(name: string): string {
  return name
    .replace(/[-_.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function sanitizePackageName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "app";
}

export async function runCreate(context: CommandContext, rest?: string[]): Promise<CommandResult> {
  const s = p.spinner();

  const projectName =
    rest && rest[0]
      ? rest[0]
      : await p.text({
          message: "Project name:",
          placeholder: "my-app",
          validate: (v) => (v ? undefined : "Project name is required."),
        });

  if (p.isCancel(projectName)) return { exitCode: 130 };

  const framework = await p.select({
    message: "Choose framework:",
    options: FRAMEWORKS.map((f) => ({ value: f.value, label: f.label })),
    initialValue: "react",
  });

  if (p.isCancel(framework)) return { exitCode: 130 };

  const frameworkDef = FRAMEWORKS.find((f) => f.value === framework)!;
  const defaultAppName = formatAppName(projectName as string);

  const appName = await p.text({
    message: "App display name:",
    placeholder: defaultAppName,
    initialValue: defaultAppName,
    validate: (v) => (v ? undefined : "App name is required."),
  });

  if (p.isCancel(appName)) return { exitCode: 130 };

  const defaultId = `com.xalo.${sanitizePackageName(projectName as string)}`;

  const packageId = await p.text({
    message: "Package ID:",
    placeholder: defaultId,
    initialValue: defaultId,
    validate: (v) => {
      if (!v) return "Package ID is required.";
      if (!/^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/.test(v)) {
        return "Invalid package ID (e.g. com.xalo.myapp).";
      }
    },
  });

  if (p.isCancel(packageId)) return { exitCode: 130 };

  const installDeps = await p.confirm({
    message: "Install dependencies?",
    initialValue: true,
  });

  if (p.isCancel(installDeps)) return { exitCode: 130 };

  const addAndroid = await p.confirm({
    message: "Add Android platform?",
    initialValue: true,
  });

  if (p.isCancel(addAndroid)) return { exitCode: 130 };

  const projectDir = projectName as string;

  console.log(chalk.dim(`\nScaffolding ${frameworkDef.label} project...`));

  const scaffoldResult = await runCommand(
    {
      label: "Scaffold project",
      cmd: "bun",
      args: ["create", "vite", projectDir, "--template", frameworkDef.template],
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!scaffoldResult.success) {
    console.error(chalk.red("Failed to scaffold project."));
    return { exitCode: 1 };
  }

  const appDir = join(process.cwd(), projectDir);

  if (installDeps) {
    s.start("Installing dependencies...");
    const depResult = await runCommand(
      { label: "Install dependencies", cmd: "bun", args: ["install"], cwd: appDir },
      { verbose: context.verbose, stdio: context.verbose ? "inherit" : "pipe" },
    );
    if (!depResult.success) {
      s.stop("Failed to install dependencies.");
      console.error(chalk.red(depResult.stderr || depResult.errorMessage));
      return { exitCode: 1 };
    }
    s.stop("Dependencies installed.");
  }

  s.start("Installing Capacitor...");
  const capResult = await runCommand(
    { label: "Install Capacitor", cmd: "bun", args: ["add", "@capacitor/core", "@capacitor/cli"], cwd: appDir },
    { verbose: context.verbose, stdio: context.verbose ? "inherit" : "pipe" },
  );
  if (!capResult.success) {
    s.stop("Failed to install Capacitor.");
    console.error(chalk.red(capResult.stderr || capResult.errorMessage));
    return { exitCode: 1 };
  }
  s.stop("Capacitor installed.");

  const initResult = await runCommand(
    { label: "Capacitor init", cmd: "bunx", args: ["cap", "init", appName as string, packageId as string], cwd: appDir },
    { verbose: context.verbose, stdio: "inherit" },
  );
  if (!initResult.success) {
    console.error(chalk.red("Capacitor init failed."));
    return { exitCode: 1 };
  }

  if (addAndroid) {
    s.start("Installing Capacitor Android platform...");
    const androidPkgResult = await runCommand(
      { label: "Install @capacitor/android", cmd: "bun", args: ["add", "@capacitor/android"], cwd: appDir },
      { verbose: context.verbose, stdio: context.verbose ? "inherit" : "pipe" },
    );
    if (!androidPkgResult.success) {
      s.stop("Failed to install @capacitor/android.");
      console.error(chalk.red(androidPkgResult.stderr || androidPkgResult.errorMessage));
      return { exitCode: 1 };
    }
    s.stop("@capacitor/android installed.");

    const addResult = await runCommand(
      { label: "Add Android platform", cmd: "bunx", args: ["cap", "add", "android"], cwd: appDir },
      { verbose: context.verbose, stdio: "inherit" },
    );
    if (!addResult.success) {
      console.error(chalk.red("Failed to add Android platform."));
      return { exitCode: 1 };
    }
  }

  const pkgPath = join(appDir, "package.json");
  const pkg = readJsonFile<Record<string, unknown>>(pkgPath);
  if (pkg) {
    const scripts: Record<string, string> = {
      ...(pkg.scripts as Record<string, string> | undefined),
      ...CAPACITOR_SCRIPTS,
    };
    if (!scripts.dev) scripts.dev = "vite";
    if (!scripts.build) scripts.build = "vite build";
    writeJsonFile(pkgPath, { ...pkg, scripts });
  }

  console.log(chalk.green(`\n✓ Created ${projectName} successfully.`));
  console.log(chalk.dim("\nNext steps:"));
  console.log(chalk.dim(`  cd ${projectDir}`));
  console.log(chalk.dim(`  bun run dev`));
  if (addAndroid) {
    console.log(chalk.dim(`  bunx cap sync android`));
  }
  console.log();

  return { exitCode: 0 };
}

import * as p from "@clack/prompts";
import chalk from "chalk";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { runCommand } from "../core/executor.js";
import type { CommandContext, CommandResult } from "./types.js";

interface Framework {
  value: string;
  label: string;
  viteTemplate: string | null;
}

const FRAMEWORKS: Framework[] = [
  { value: "react", label: "React + TypeScript", viteTemplate: "react-ts" },
  { value: "vue", label: "Vue + TypeScript", viteTemplate: "vue-ts" },
  { value: "svelte", label: "Svelte + TypeScript", viteTemplate: "svelte-ts" },
  { value: "solid", label: "Solid + TypeScript", viteTemplate: "solid-ts" },
  { value: "preact", label: "Preact + TypeScript", viteTemplate: "preact-ts" },
  { value: "lit", label: "Lit + TypeScript", viteTemplate: "lit-ts" },
  { value: "vanilla", label: "Vanilla TypeScript", viteTemplate: "vanilla-ts" },
  { value: "angular", label: "Angular", viteTemplate: null },
];

const PM_ENTRIES = [
  { value: "npm", label: "npm" },
  { value: "bun", label: "bun" },
  { value: "pnpm", label: "pnpm" },
  { value: "yarn", label: "yarn" },
];

function scaffoldViteArgs(pm: string, projectDir: string, template: string): { cmd: string; args: string[]; env?: Record<string, string> } | null {
  const env = { CI: "true" };
  switch (pm) {
    case "npm":
      return { cmd: "npx", args: ["create-vite@latest", projectDir, "--template", template, "--force"], env };
    case "bun":
      return { cmd: "bunx", args: ["create-vite", projectDir, "--template", template, "--force"], env };
    case "pnpm":
      return { cmd: "pnpm", args: ["dlx", "create-vite", projectDir, "--template", template, "--force"], env };
    case "yarn":
      return { cmd: "yarn", args: ["dlx", "create-vite", projectDir, "--template", template, "--force"], env };
    default:
      return null;
  }
}

function installArgs(pm: string, packages: string[]): { cmd: string; args: string[] } | null {
  switch (pm) {
    case "npm":
      return { cmd: "npm", args: ["install", ...packages] };
    case "bun":
      return { cmd: "bun", args: ["add", ...packages] };
    case "pnpm":
      return { cmd: "pnpm", args: ["add", ...packages] };
    case "yarn":
      return { cmd: "yarn", args: ["add", ...packages] };
    default:
      return null;
  }
}

function isDirEmpty(dir: string): boolean {
  try {
    return readdirSync(dir).length === 0;
  } catch {
    return true;
  }
}

function validateProjectPath(path: string, framework: Framework): string | null {
  if (existsSync(path)) {
    if (framework.viteTemplate) {
      const entries = readdirSync(path);
      if (entries.length > 0 && entries.some((e) => e !== ".git")) {
        return `Directory "${path}" is not empty.`;
      }
    } else {
      return `Directory "${path}" already exists. Angular requires a new directory.`;
    }
  }
  return null;
}

export async function runCreate(context: CommandContext, rest?: string[]): Promise<CommandResult> {
  const s = p.spinner();

  const projectName =
    rest && rest[0]
      ? rest[0]
      : await p.text({
          message: "Project name:",
          placeholder: "my-app",
          validate: (val) => (val ? undefined : "Project name is required."),
        });

  if (p.isCancel(projectName)) {
    p.cancel("Cancelled.");
    return { exitCode: 130 };
  }

  const framework = await p.select({
    message: "Pick a framework:",
    options: FRAMEWORKS.map((f) => ({ value: f.value, label: f.label })),
  });

  if (p.isCancel(framework)) {
    p.cancel("Cancelled.");
    return { exitCode: 130 };
  }

  const frameworkDef = FRAMEWORKS.find((f) => f.value === framework)!;

  const locationChoice = await p.select({
    message: "Where should we create it?",
    options: [
      { value: "subdir", label: `In a subdirectory called "${projectName}"`, hint: `./${projectName}` },
      { value: "cwd", label: "In the current directory", hint: "." },
      { value: "custom", label: "Specify a different path" },
    ],
  });

  if (p.isCancel(locationChoice)) {
    p.cancel("Cancelled.");
    return { exitCode: 130 };
  }

  let projectDir: string;
  if (locationChoice === "subdir") {
    projectDir = projectName as string;
  } else if (locationChoice === "cwd") {
    if (!frameworkDef.viteTemplate) {
      p.note("Angular always creates a subdirectory. Falling back to subdirectory mode.");
      projectDir = projectName as string;
    } else {
      const cwdEmpty = isDirEmpty(process.cwd());
      if (!cwdEmpty) {
        const proceed = await p.confirm({
          message: "Current directory is not empty. Continue anyway?",
          initialValue: false,
        });
        if (p.isCancel(proceed) || !proceed) {
          p.cancel("Cancelled.");
          return { exitCode: 130 };
        }
      }
      projectDir = ".";
    }
  } else {
    const customPath = await p.text({
      message: "Enter the path:",
      placeholder: `./${projectName}`,
      validate: (val) => (val ? undefined : "Path is required."),
    });
    if (p.isCancel(customPath)) {
      p.cancel("Cancelled.");
      return { exitCode: 130 };
    }
    projectDir = customPath as string;
  }

  const pm = await p.select({
    message: "Which package manager?",
    options: PM_ENTRIES,
  });

  if (p.isCancel(pm)) {
    p.cancel("Cancelled.");
    return { exitCode: 130 };
  }

  if (locationChoice !== "cwd" && projectDir !== ".") {
    const fullPath = resolve(projectDir);
    const err = validateProjectPath(fullPath, frameworkDef);
    if (err) {
      console.error(chalk.red(err));
      return { exitCode: 1 };
    }
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  }

  console.log(chalk.dim(`\nScaffolding ${frameworkDef.label} project...`));

  let scaffoldOk = false;
  if (frameworkDef.viteTemplate) {
    const spec = scaffoldViteArgs(pm as string, projectDir, frameworkDef.viteTemplate);
    if (!spec) {
      console.error(chalk.red(`Unsupported package manager: ${pm}`));
      return { exitCode: 1 };
    }
    const result = await runCommand(
      { label: "Scaffold project", cmd: spec.cmd, args: spec.args, env: spec.env },
      { verbose: context.verbose, stdio: "inherit" },
    );
    scaffoldOk = result.success;
  } else {
    const angularArgs: string[] = ["new", projectDir, "--style=css", "--routing=false", "--skip-git", "--skip-install"];
    const result = await runCommand(
      { label: "Scaffold Angular project", cmd: "npx", args: ["@angular/cli", ...angularArgs], env: { CI: "true" } },
      { verbose: context.verbose, stdio: "inherit" },
    );
    scaffoldOk = result.success;
  }

  if (!scaffoldOk) {
    console.error(chalk.red("Failed to scaffold project."));
    return { exitCode: 1 };
  }

  const appDir = projectDir === "." ? process.cwd() : resolve(projectDir);

  const addCapacitor = await p.confirm({
    message: "Add Capacitor + Android support?",
    initialValue: true,
  });

  if (p.isCancel(addCapacitor)) {
    p.cancel("Capacitor setup skipped.");
  }

  if (addCapacitor) {
    s.start("Installing Capacitor packages...");

    const installSpec = installArgs(pm as string, ["@capacitor/core", "@capacitor/cli"]);
    if (installSpec) {
      const installResult = await runCommand(
        { label: "Install Capacitor", cmd: installSpec.cmd, args: installSpec.args, cwd: appDir },
        { verbose: context.verbose, stdio: context.verbose ? "inherit" : "pipe" },
      );
      if (!installResult.success) {
        s.stop("Failed to install Capacitor.");
        console.error(chalk.red(installResult.stderr || installResult.errorMessage));
        return { exitCode: 1 };
      }
    }

    const appName = projectName as string;
    const appId = `com.example.${appName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "app"}`;

    s.stop("Capacitor packages installed.");

    const initResult = await runCommand(
      { label: "Capacitor init", cmd: "npx", args: ["cap", "init", appName, appId], cwd: appDir },
      { verbose: context.verbose, stdio: "inherit" },
    );

    if (!initResult.success) {
      console.error(chalk.red("Capacitor init failed."));
      return { exitCode: 1 };
    }

    s.start("Adding Android platform...");
    const addResult = await runCommand(
      { label: "Add Android", cmd: "npx", args: ["cap", "add", "android"], cwd: appDir },
      { verbose: context.verbose, stdio: "inherit" },
    );

    if (!addResult.success) {
      s.stop("Failed to add Android platform.");
      console.error(chalk.red(addResult.stderr || addResult.errorMessage));
      return { exitCode: 1 };
    }

    s.stop("Android platform added.");
  }

  const relativeDir = projectDir === "." ? "current directory" : `./${projectDir}`;
  console.log(chalk.green(`\n✓ Project created in ${relativeDir}`));
  console.log(chalk.dim("\nNext steps:"));
  if (projectDir !== ".") {
    console.log(chalk.dim(`  cd ${projectDir}`));
  }
  if (addCapacitor) {
    console.log(chalk.dim(`  ${pm} run build`));
    console.log(chalk.dim(`  shg dev`));
  } else {
    console.log(chalk.dim(`  shg setup --install --add-android`));
    console.log(chalk.dim(`  shg dev`));
  }
  console.log();

  return { exitCode: 0 };
}

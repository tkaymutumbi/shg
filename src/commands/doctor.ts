import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { hasAndroidPlatform } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

const MIN_GRADLE_VERSION = 8;

interface DoctorCheck {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  details: string;
  fix?: string;
  safeFix?: () => Promise<void>;
}

function statusIcon(status: DoctorCheck["status"]): string {
  if (status === "pass") return chalk.green("✔");
  if (status === "warn") return chalk.yellow("! ");
  return chalk.red("✘");
}

async function checkCommandVersion(cmd: string, args: string[], title: string, fix: string): Promise<DoctorCheck> {
  const result = await runCommand(
    { label: `${cmd} version`, cmd, args },
    { stdio: "pipe" },
  );

  if (result.success) {
    const snippet = (result.stdout || result.stderr).split(/\r?\n/)[0] ?? "available";
    return { id: cmd, title, status: "pass", details: snippet.trim() };
  }

  return {
    id: cmd,
    title,
    status: "fail",
    details: `${cmd} not available`,
    fix,
  };
}

export async function runDoctor(context: CommandContext): Promise<CommandResult> {
  const checks: DoctorCheck[] = [];
  const fixEnabled = Boolean(context.flags.fix) || context.config.doctor.allowSafeFixes;

  checks.push(
    await checkCommandVersion(
      "node",
      ["--version"],
      "Node.js",
      "Install Node.js 18+ and retry.",
    ),
  );

  checks.push(
    await checkCommandVersion("bun", ["--version"], "bun", "Install bun and retry."),
  );

  checks.push(
    await checkCommandVersion(
      "java",
      ["-version"],
      "Java",
      "Install JDK and ensure `java` is on PATH.",
    ),
  );

  const adbCheck = await checkCommandVersion(
    "adb",
    ["version"],
    "Android Debug Bridge (adb)",
    "Install Android platform-tools and ensure `adb` is on PATH.",
  );
  checks.push(adbCheck);

  const sdkRoot = process.env.ANDROID_SDK_ROOT ?? process.env.ANDROID_HOME;
  let sdkStatus: DoctorCheck["status"] = "warn";
  let sdkDetails = sdkRoot ? sdkRoot : "ANDROID_SDK_ROOT/ANDROID_HOME not set";
  if (sdkRoot) {
    const platformsDir = join(sdkRoot, "platforms");
    sdkStatus = existsSync(platformsDir) ? "pass" : "warn";
    sdkDetails = existsSync(platformsDir) ? sdkRoot : `${sdkRoot} (platforms/ missing)`;
  }
  checks.push({
    id: "android-sdk",
    title: "Android SDK env",
    status: sdkStatus,
    details: sdkDetails,
    fix: "Export ANDROID_SDK_ROOT pointing to a valid Android SDK installation.",
  });

  checks.push(await checkCommandVersion("gradle", ["--version"], "Gradle", "Install Gradle or use the Gradle wrapper."));

  if (!context.projectRoot) {
    checks.push({
      id: "project",
      title: "Capacitor project",
      status: "fail",
      details: "No capacitor.config.ts/js/json found in this directory tree.",
      fix: "Run from your Capacitor project root.",
    });
  } else {
    checks.push({
      id: "project",
      title: "Capacitor project",
      status: "pass",
      details: `Detected at ${context.projectRoot}`,
    });

    const hasPlatform = hasAndroidPlatform(context.projectRoot);
    checks.push({
      id: "android-platform",
      title: "Android platform folder",
      status: hasPlatform ? "pass" : "warn",
      details: hasPlatform ? "android/ exists" : "android/ missing",
      fix: "Run `shg setup --add-android`.",
    });

    const pkgPath = join(context.projectRoot, "package.json");
    if (existsSync(pkgPath)) {
      const installCheck: DoctorCheck = {
        id: "capacitor-deps",
        title: "Capacitor dependencies",
        status: "warn",
        details: "Unable to validate dependencies",
        fix: "Run `shg setup --install`.",
      };
      const lsResult = await runCommand(
        {
          label: "bun pm ls",
          cmd: "bun",
          args: ["pm", "ls"],
          cwd: context.projectRoot,
        },
        { stdio: "pipe" },
      );

      if (lsResult.success) {
        installCheck.status = "pass";
        installCheck.details = "@capacitor/core and @capacitor/cli detected";
      } else {
        installCheck.status = "warn";
        installCheck.details = "Capacitor deps missing or not installed";
        installCheck.safeFix = async () => {
          await runCommand(
            {
              label: "bun add @capacitor/core @capacitor/cli",
              cmd: "bun",
              args: ["add", "@capacitor/core", "@capacitor/cli"],
              cwd: context.projectRoot,
            },
            { stdio: "inherit" },
          );
        };
      }
      checks.push(installCheck);
    }
  }

  if (fixEnabled) {
    for (const check of checks) {
      if (check.safeFix && check.status !== "pass") {
        await check.safeFix();
      }
    }
  }

  if (context.json || context.flags.json) {
    console.log(
      JSON.stringify(
        {
          checks: checks.map((check) => ({
            id: check.id,
            title: check.title,
            status: check.status,
            details: check.details,
            fix: check.fix,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(chalk.cyan("\nSHG Doctor Report\n"));
    for (const check of checks) {
      console.log(`${statusIcon(check.status)} ${check.title}: ${check.details}`);
      if (check.fix && check.status !== "pass") {
        console.log(chalk.dim(`   Fix: ${check.fix}`));
      }
    }
    console.log("");
  }

  const hasFailure = checks.some((check) => check.status === "fail");
  return { exitCode: hasFailure ? 1 : 0 };
}

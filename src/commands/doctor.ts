import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { hasAndroidPlatform, webDirExists, readWebDir, findAndroidSdkRoot, emitJson, getCapacitorDependencyMajorMismatch, getCapacitorDependencyVersions, readAndroidJavaTarget } from "../core/project.js";
import { listAndroidDevices, connectOverWifi } from "../core/android.js";
import type { CommandContext, CommandResult } from "./types.js";

const MIN_GRADLE_VERSION = 8;

export interface DoctorCheck {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  details: string;
  fix?: string;
  safeFix?: () => Promise<void>;
}

export function statusIcon(status: DoctorCheck["status"]): string {
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

function parseJavaMajor(versionOutput: string): number | undefined {
  const quoted = versionOutput.match(/version\s+"(\d+)(?:\.(\d+))?/);
  if (quoted) return Number.parseInt(quoted[1], 10);

  const fallback = versionOutput.match(/(?:openjdk|java)\s+(\d+)/i);
  return fallback ? Number.parseInt(fallback[1], 10) : undefined;
}

async function checkGradle(context: CommandContext): Promise<DoctorCheck> {
  const fromOutput = (output: string, wrapper: boolean): DoctorCheck => {
    const major = Number.parseInt(output.match(/Gradle\s+(\d+)/i)?.[1] ?? "", 10);
    const tooOld = Number.isFinite(major) && major < MIN_GRADLE_VERSION;
    return {
      id: "gradle",
      title: "Gradle",
      status: !Number.isFinite(major) ? "warn" : tooOld ? "fail" : "pass",
      details: `${output.match(/Gradle\s+[^\s]+/i)?.[0] ?? "Gradle available"}${wrapper ? " (via wrapper)" : ""}`,
      fix: !Number.isFinite(major)
        ? "Could not determine the Gradle version; run `gradle --version` manually."
        : tooOld
        ? wrapper ? `Update the Gradle wrapper to ${MIN_GRADLE_VERSION}+.` : `Upgrade Gradle to ${MIN_GRADLE_VERSION}+.`
        : undefined,
    };
  };

  if (context.projectRoot) {
    const gradlewPath = join(context.projectRoot, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
    if (existsSync(gradlewPath)) {
      const wrapperResult = await runCommand(
        { label: "gradlew --version", cmd: gradlewPath, args: ["--version"] },
        { stdio: "pipe" },
      );

      if (wrapperResult.success) {
        return fromOutput(wrapperResult.stdout || wrapperResult.stderr, true);
      }
    }
  }

  const gradleResult = await runCommand(
    { label: "gradle --version", cmd: "gradle", args: ["--version"] },
    { stdio: "pipe" },
  );
  if (gradleResult.success) return fromOutput(gradleResult.stdout || gradleResult.stderr, false);

  return {
    id: "gradle",
    title: "Gradle",
    status: "fail",
    details: "gradle not available",
    fix: "Install Gradle or use the Gradle wrapper.",
  };
}

export async function runDoctor(context: CommandContext): Promise<CommandResult> {
  const checks: DoctorCheck[] = [];
  const silent = Boolean(context.flags.__silent);
  const json = Boolean(context.json || context.flags.json);
  if (json && context.flags.fix && !silent) {
    emitJson({ success: false, error: "--json and --fix cannot be combined because fixes may require interactive input." });
    return { exitCode: 2 };
  }
  const fixEnabled = !silent && !json && (Boolean(context.flags.fix) || context.config.doctor.allowSafeFixes);

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

  const javaCheck = await checkCommandVersion(
    "java",
    ["-version"],
    "Java",
    "Install JDK and ensure `java` is on PATH.",
  );
  checks.push(javaCheck);

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
  let sdkFix = "Export ANDROID_SDK_ROOT pointing to a valid Android SDK installation.";
  if (sdkRoot) {
    const platformsDir = join(sdkRoot, "platforms");
    const hasPlatform = existsSync(platformsDir)
      && readdirSync(platformsDir).some((name) => name.startsWith("android-"));
    sdkStatus = hasPlatform ? "pass" : "warn";
    sdkDetails = hasPlatform ? sdkRoot : `${sdkRoot} (no installed Android platforms)`;
  } else {
    const found = findAndroidSdkRoot();
    if (found) {
      sdkDetails = `Not set. Found SDK at: ${found}`;
      sdkFix = `Run: export ANDROID_SDK_ROOT="${found}"`;
    }
  }
  checks.push({
    id: "android-sdk",
    title: "Android SDK env",
    status: sdkStatus,
    details: sdkDetails,
    fix: sdkFix,
  });

  const gradleCheck = await checkGradle(context);
  checks.push(gradleCheck);

  if (adbCheck.status === "pass") {
    const devices = await listAndroidDevices();
    const readyDevices = devices.filter((device) => device.status === "device");
    if (readyDevices.length === 0) {
      checks.push({
        id: "device",
        title: "Android device connected",
        status: "warn",
        details: devices.length === 0
          ? "No devices found"
          : `No ready devices: ${devices.map((device) => `${device.id} (${device.status})`).join(", ")}`,
        fix: "Connect a device via USB, or use `shg doctor --fix` to connect wirelessly.",
        safeFix: async () => { await connectOverWifi(); },
      });
    } else {
      const deviceList = readyDevices.map((d) => `${d.id} (${d.status})`).join(", ");
      checks.push({
        id: "device",
        title: "Android device connected",
        status: "pass",
        details: `${readyDevices.length} ready device(s): ${deviceList}`,
      });
    }
  }

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

    const webDir = readWebDir(context.projectRoot);
    const hasWebDir = webDirExists(context.projectRoot);
    checks.push({
      id: "web-assets",
      title: "Web assets directory",
      status: hasWebDir ? "pass" : "warn",
      details: hasWebDir ? `${webDir}/ exists` : `${webDir}/ missing`,
      fix: "Run `bun run build` or create the directory manually.",
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
        const versions = getCapacitorDependencyVersions(context.projectRoot);
        const mismatch = getCapacitorDependencyMajorMismatch(context.projectRoot);
        if (mismatch) {
          installCheck.status = "fail";
          installCheck.details = `Capacitor package majors do not match: ${Object.entries(mismatch.versions).map(([name, version]) => `${name}=${version}`).join(", ")}`;
          installCheck.fix = "Align @capacitor/core, @capacitor/cli, and platform packages to the same major version, then run `bun install && bunx cap sync android`.";
        } else {
          if (Object.keys(versions).length === 0) {
            installCheck.status = "fail";
            installCheck.details = "No @capacitor packages declared in package.json";
          } else {
            installCheck.status = "pass";
            installCheck.details = Object.entries(versions).map(([name, version]) => `${name}=${version}`).join(", ");
          }
        }
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

      const javaMajor = parseJavaMajor(javaCheck.details);
      const javaTarget = readAndroidJavaTarget(context.projectRoot);
      if (javaMajor && javaTarget) {
        checks.push({
          id: "android-java-target",
          title: "Android Java target",
          status: javaTarget > javaMajor ? "fail" : "pass",
          details: `Project targets Java ${javaTarget}; current JDK is Java ${javaMajor}`,
          fix: javaTarget > javaMajor
            ? `Install JDK ${javaTarget}+ or lower the Android compile target before running shg dev/build.`
            : undefined,
        });
      }
    }
  }

  if (fixEnabled) {
    for (const check of checks) {
      if (check.safeFix && check.status !== "pass") {
        const shouldFix = await p.confirm({
          message: `Fix "${check.title}"? ${check.details}`,
          initialValue: true,
        });
        if (shouldFix) {
          await check.safeFix();
        }
      }
    }
  }

  if (silent) {
    // The caller owns the final machine-readable output.
  } else if (json) {
    emitJson({
      checks: checks.map((check) => ({
        id: check.id,
        title: check.title,
        status: check.status,
        details: check.details,
        fix: check.fix,
      })),
    });
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

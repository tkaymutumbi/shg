import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { loadState, saveState } from "../core/state.js";
import type { CommandContext, CommandResult } from "./types.js";

export interface RunOptions {
  skipSync?: boolean;
}

function getStringFlag(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function resolveRunValues(context: CommandContext) {
  if (!context.projectRoot) {
    return {
      device: getStringFlag(context.flags, "device") ?? context.config.defaultDeviceId,
      variant: getStringFlag(context.flags, "variant") ?? context.config.defaultVariant,
      flavor: getStringFlag(context.flags, "flavor") ?? context.config.defaultFlavor,
    };
  }

  const state = loadState(context.projectRoot);
  return {
    device: getStringFlag(context.flags, "device") || context.config.defaultDeviceId || state.lastDeviceId,
    variant: getStringFlag(context.flags, "variant") || context.config.defaultVariant || state.lastVariant || "debug",
    flavor: getStringFlag(context.flags, "flavor") || context.config.defaultFlavor || state.lastFlavor || "",
  };
}

export async function runRun(context: CommandContext, options: RunOptions = {}): Promise<CommandResult> {
  if (!context.projectRoot) {
    console.error(chalk.red("Run command requires a Capacitor project root."));
    return { exitCode: 1 };
  }

  const { device, variant, flavor } = resolveRunValues(context);

  if (!options.skipSync && context.config.autoSyncBeforeRun) {
      const syncResult = await runCommand(
        {
          label: "bunx cap sync android",
          cmd: "bunx",
          args: ["cap", "sync", "android"],
          cwd: context.projectRoot,
        },
        { verbose: context.verbose, stdio: "inherit" },
      );

    if (!syncResult.success) {
      return { exitCode: 1 };
    }
  }

  const args = ["cap", "run", "android"];
  if (device) {
    args.push("--target", device);
  }
  if (variant) {
    args.push("--configuration", variant);
  }
  if (flavor) {
    args.push("--flavor", flavor);
  }

  const result = await runCommand(
    {
      label: "bunx cap run android",
      cmd: "bunx",
      args,
      cwd: context.projectRoot,
    },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    return { exitCode: 1 };
  }

  saveState(context.projectRoot, {
    lastDeviceId: device,
    lastVariant: variant,
    lastFlavor: flavor,
  });

  console.log(chalk.green("Run complete."));
  return { exitCode: 0 };
}

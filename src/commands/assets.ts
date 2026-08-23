import chalk from "chalk";
import { runCommand } from "../core/executor.js";
import { prepareAssetSource } from "../core/assets.js";
import { requireProjectRoot } from "../core/project.js";
import type { CommandContext, CommandResult } from "./types.js";

export async function runAssets(context: CommandContext): Promise<CommandResult> {
  const projectRoot = requireProjectRoot(context, "Assets");
  if (!projectRoot) return { exitCode: 1 };

  const sourceCheck = prepareAssetSource(projectRoot);
  if (sourceCheck.error || !sourceCheck.source) {
    console.error(chalk.red("Asset generation cannot start."));
    console.error(chalk.yellow(`  ${sourceCheck.error ?? "No usable icon source was found."}`));
    if (sourceCheck.checkedPaths.length > 0) {
      console.log(chalk.dim("  Checked:"));
      for (const path of sourceCheck.checkedPaths) console.log(chalk.dim(`    - ${path}`));
    }
    console.log(chalk.dim("  The source must be a readable, self-contained SVG, PNG, or JPEG."));
    return { exitCode: 1 };
  }

  console.log(chalk.cyan(`Generating Android app icons and splash screens from ${sourceCheck.source.path}...`));
  if (sourceCheck.source.copiedFrom) {
    console.log(chalk.dim(`  Copied project icon source from ${sourceCheck.source.copiedFrom} into assets/.`));
  }

  const result = await runCommand(
    { label: "bunx @capacitor/assets generate", cmd: "bunx", args: ["@capacitor/assets", "generate", "--android"], cwd: projectRoot },
    { verbose: context.verbose, stdio: "inherit" },
  );

  if (!result.success) {
    console.error(chalk.red("Asset generation failed after the icon source passed validation."));
    console.log(chalk.yellow("  Install or allow the Capacitor asset generator: bun add -d @capacitor/assets"));
    console.log(chalk.dim("  Then retry `shg assets` from the project root."));
    return { exitCode: 1 };
  }

  console.log(chalk.green("Assets generated."));
  return { exitCode: 0 };
}

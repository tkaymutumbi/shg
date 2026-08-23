import { execa } from "execa";

export const DEFAULT_COMMAND_TIMEOUT_MS = 5 * 60 * 1000;

export interface CommandSpec {
  label: string;
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  /** Set to 0 for intentionally long-running commands such as logcat. */
  timeout?: number;
}

export interface ExecutorOptions {
  verbose?: boolean;
  stdio?: "inherit" | "pipe";
}

export interface ExecResult {
  success: boolean;
  code: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
}

export async function runCommand(
  spec: CommandSpec,
  options: ExecutorOptions = {},
): Promise<ExecResult> {
  const { verbose = false, stdio = "inherit" } = options;
  const timeout = spec.timeout === 0
    ? undefined
    : spec.timeout ?? DEFAULT_COMMAND_TIMEOUT_MS;

  if (verbose) {
    console.log(`[shg] ${spec.cmd} ${spec.args.join(" ")}`);
  }

  try {
    const result = await execa(spec.cmd, spec.args, {
      cwd: spec.cwd,
      stdio,
      reject: false,
      env: spec.env,
      timeout,
    });

    return {
      success: result.exitCode === 0,
      code: result.exitCode ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      errorMessage: result.timedOut ? `Command timed out after ${timeout}ms.` : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown execution failure";
    return {
      success: false,
      code: 1,
      stdout: "",
      stderr: "",
      errorMessage: message,
    };
  }
}

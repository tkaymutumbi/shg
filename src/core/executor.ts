import { execa } from "execa";

export interface CommandSpec {
  label: string;
  cmd: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
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

  if (verbose) {
    console.log(`[shg] ${spec.cmd} ${spec.args.join(" ")}`);
  }

  try {
    const result = await execa(spec.cmd, spec.args, {
      cwd: spec.cwd,
      stdio,
      reject: false,
      env: spec.env,
    });

    return {
      success: result.exitCode === 0,
      code: result.exitCode ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
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

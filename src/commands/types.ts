import type { ShgConfig } from "../core/config.js";

export interface CommandContext {
  projectRoot?: string;
  config: ShgConfig;
  verbose: boolean;
  json: boolean;
  flags: Record<string, string | boolean>;
}

export interface CommandResult {
  exitCode: number;
}

export type RootCommand = "doctor" | "deploy" | "setup" | "run" | "devices" | "config" | "dev" | "logs" | "plugin" | "open" | "build" | "clean" | "assets" | "bump" | "upgrade" | "create";

export interface ParsedArgs {
  command?: RootCommand;
  rest: string[];
  flags: Record<string, string | boolean>;
  help: boolean;
  version: boolean;
  errors: string[];
}

const SHORT_FLAG_MAP: Record<string, string> = {
  h: "help",
  v: "version",
};

const VALUE_FLAGS = new Set(["device", "variant", "flavor", "host", "port", "tag", "level", "to", "platform"]);
const BOOLEAN_FLAGS = new Set([
  "help", "version", "verbose", "json", "wifi", "skip-build", "fix",
  "all", "build", "sync", "run", "install", "init", "update",
  "add-android", "release", "no-sync", "global", "aab", "apk", "both",
]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const rest: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token.startsWith("--")) {
      const raw = token.slice(2);
      const [name, inlineValue] = raw.split("=", 2);
      if (!name) {
        errors.push(`Invalid flag: ${token}`);
        continue;
      }

      if (!VALUE_FLAGS.has(name) && !BOOLEAN_FLAGS.has(name)) {
        errors.push(`Unknown flag: --${name}`);
        continue;
      }

      if (inlineValue !== undefined) {
        if (VALUE_FLAGS.has(name)) flags[name] = inlineValue;
        else errors.push(`Flag --${name} does not take a value`);
        continue;
      }

      if (VALUE_FLAGS.has(name)) {
        const next = argv[i + 1];
        if (!next || next.startsWith("-")) {
          errors.push(`Missing value for --${name}`);
          continue;
        }
        flags[name] = next;
        i += 1;
      } else {
        flags[name] = true;
      }
      continue;
    }

    if (token.startsWith("-") && token.length > 1) {
      const shortFlags = token.slice(1).split("");
      for (const shortFlag of shortFlags) {
        const mapped = SHORT_FLAG_MAP[shortFlag];
        if (!mapped) {
          errors.push(`Unknown short flag: -${shortFlag}`);
          continue;
        }
        flags[mapped] = true;
      }
      continue;
    }

    rest.push(token);
  }

  const command = rest[0] as RootCommand | undefined;
  const knownCommands: RootCommand[] = ["doctor", "deploy", "setup", "run", "devices", "config", "dev", "logs", "plugin", "open", "build", "clean", "assets", "bump", "upgrade", "create"];
  if (command && !knownCommands.includes(command)) {
    errors.push(`Unknown command: ${command}`);
  }

  return {
    command,
    rest: rest.slice(1),
    flags,
    help: Boolean(flags.help),
    version: Boolean(flags.version),
    errors,
  };
}

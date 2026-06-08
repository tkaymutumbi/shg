# Contributing to SHG CLI

Thanks for your interest in contributing! Here's how to get started.

## Reporting Issues

- Search [existing issues](https://github.com/Diplovee/shg/issues) first
- Include SHG version (`shg --version`), OS, Node/Bun version, and relevant logs
- Use `--verbose` flag and include the output

## Submitting Pull Requests

1. Fork the repo and create a branch from `main`
2. Run `bun run smoke` to ensure type-checking and build pass
3. Write or update tests if applicable
4. Keep PRs focused — one feature/fix per PR
5. Update the README and CHANGELOG if your change affects users

## Code Style

- **Language:** TypeScript (strict mode)
- **Runtime:** Bun (no npm scripts)
- **Formatting:** No prettier config yet — keep it clean and consistent with existing code
- **Imports:** Use ESM (`import`/`export`) with `.js` extensions in relative imports
- **Naming:** `camelCase` for variables/functions, `PascalCase` for types/interfaces

## Project Structure

```
src/
├── index.ts              # Entry point + CLI dispatch
├── interactive.ts        # Interactive TUI mode
├── commands/
│   ├── types.ts          # Shared types
│   ├── assets.ts
│   ├── build.ts
│   ├── bump.ts
│   ├── clean.ts
│   ├── config.ts
│   ├── deploy.ts
│   ├── dev.ts
│   ├── devices.ts
│   ├── doctor.ts
│   ├── logs.ts
│   ├── open.ts
│   ├── plugin.ts
│   ├── run.ts
│   ├── setup.ts
│   └── upgrade.ts
├── core/
│   ├── agent-doc.ts      # .shg/AGENTS.md generation
│   ├── android.ts         # ADB device parsing
│   ├── args.ts            # CLI argument parser
│   ├── config.ts          # Config loading/merging
│   ├── executor.ts        # Command execution
│   ├── fsjson.ts          # JSON file read/write
│   ├── project.ts         # Project root detection
│   ├── state.ts           # Runtime state persistence
│   └── version.ts         # Version from package.json
```

## Adding a New Command

1. Create `src/commands/<name>.ts` exporting `run<Name>(context, rest?)`
2. Add the import and dispatch in `src/index.ts`
3. Register the command name in `src/core/args.ts` (`RootCommand` type + `knownCommands`)
4. Add an interactive option in `src/interactive.ts`
5. Add CLI help text in the `printHelp()` function in `src/index.ts`
6. Update `src/core/agent-doc.ts` template
7. Document the command in `README.md`

## Testing

Run diagnostics with a test Capacitor project:

```bash
mkdir -p /tmp/test-cap && touch /tmp/test-cap/capacitor.config.ts
shg doctor
```

For full integration tests, use a real Capacitor project.

## Release Process

1. Bump version in `package.json`
2. Update `CHANGELOG.md`
3. Commit with message format: `Release <version> — <summary>`
4. Tag the release: `git tag v<version>`
5. Push: `git push && git push --tags`

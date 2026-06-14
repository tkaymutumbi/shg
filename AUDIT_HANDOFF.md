# SHG CLI — Audit Handoff

**Date**: 2026-06-11
**Auditor**: opencode
**Scope**: Full codebase audit of all commands/modules (`src/`)

---

## Critical Bugs (Fix Before Next Release)

### 1. `src/commands/build.ts:44` — Gradle task missing `assemble` prefix with flavors

When `--flavor` is specified, the Gradle task is set as:

```ts
const task = flavor ? `${flavor}${capitalize(variant)}` : `assemble${capitalize(variant)}`;
```

For `--flavor demo --variant debug`, this produces `demoDebug` instead of `assembleDemoDebug`. Gradle will fail to find the task.

**Fix**: Change to `assemble${capitalize(flavor)}${capitalize(variant)}`.

---

### 2. `src/commands/run.ts:108-113` — Hard-coded APK path

```ts
join(projectRoot, "android", "app", "build", "outputs", "apk",
  variant === "release" ? "release" : "debug",
  `app-${variant === "release" ? "release" : "debug"}.apk`);
```

Assumes standard Gradle output layout. Breaks with:
- Product flavors (output goes to `apk/<flavor>/<variant>/`)
- Custom `applicationIdSuffix`
- AAB builds

---

### 3. `src/commands/run.ts:126` — Deprecated `monkey` tool

```ts
args: ["-s", device, "shell", "monkey", "-p", appId, "1"]
```

`adb shell monkey` is deprecated since Android 12 (API 31). Replaced by `am start`. Use:

```
adb shell am start -n <package>/<activity>
```

This requires knowing the launcher activity (can be read from `android/app/src/main/AndroidManifest.xml`).

---

### 4. `src/commands/dev.ts:15` — `getLanIp()` can produce literal `"undefined"`

```ts
let host = typeof context.flags.host === "string" ? context.flags.host
  : (wifi ? getLanIp() : "localhost");
```

`getLanIp()` returns `string | undefined`. On failure, `host` becomes the **string `"undefined"`**, which gets passed to `cap run android --live-reload`.

**Fix**: Fall back to `"0.0.0.0"` or `"localhost"` when `getLanIp()` is undefined.

---

## High Priority

### 5. Regex-based config mutation — `src/commands/bump.ts:43-54` & `src/core/project.ts:57`

`updateCapacitorConfig` uses `String.replace()` with regexes on raw file content. It fails/corrupts on:
- TypeScript configs (`capacitor.config.ts`) using template literals
- Single-quoted strings
- Minified JSON
- Comments containing matching patterns

`readCapacitorConfigValue` has the same regex fragility for non-JSON configs.

**Fix**: Parse JS/TS files via AST (or use JSON.parse for JSON configs exclusively).

---

### 6. `src/commands/deploy.ts:32` — Doctor loses parent flags

```ts
const doctorResult = await runDoctor({ ...context, flags: {} });
```

Deploy passes **empty flags** to doctor. `--json` and `--verbose` from `shg deploy --json` are silently dropped during the doctor phase.

**Fix**: Forward relevant flags, at minimum `--json` and `--verbose`.

---

### 7. `src/commands/build.ts:15` — Variant flag ignored when `--release` is false

```ts
const variant = release ? "release"
  : (typeof context.flags.variant === "string" ? context.flags.variant : "debug");
```

`shg build --variant staging` works when `--release` is absent. But `shg build --release --variant staging` always uses `"release"`. The `--variant` flag is ignored when `--release` is set. Should error or honor combination.

---

## Medium Priority

### 8. `src/core/android.ts:175` — Hard-coded `wlan0` interface

`getDeviceIp` always queries `wlan0`. Some devices use `wlan1` or vendor names (`eth0`, `wl0.1`). Should iterate interfaces or use `ip route` to determine the active WiFi interface.

---

### 9. `src/core/android.ts:102` — Downloaded zip never cleaned up

`platform-tools.zip` is downloaded to `~/.shg/platform-tools.zip` but never deleted after extraction.

---

### 10. `src/commands/doctor.ts:75-87` — Symlink shadows system `gradle`

The `safeFix` for missing Gradle creates `~/.local/bin/gradle → gradlew`. This shadows a system Gradle install if the user adds one later. Also, `gradlew` is a wrapper that downloads Gradle on first run — having it as `gradle` on PATH is misleading.

---

### 11. `src/commands/create.ts:35` — `sanitizePackageName` can produce invalid Java package segments

```ts
return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "app";
```

A project named `"123app"` → `"123app"`, producing package ID `"com.xalo.123app"`. Java package segments cannot start with a digit. The later validation catches it, but the default suggested value is always invalid.

---

### 12. `src/core/args.ts:17` — Dead `"platform"` value flag

`"platform"` is in `VALUE_FLAGS` but `runOpen` never reads `flags.platform`. It always runs `bunx cap open android`.

---

### 13. `src/interactive.ts:134` — `tag` not narrowed from `string | symbol`

```ts
if (tag && tag !== "Capacitor") flags.tag = tag;
```

`tag` is `string | symbol` from `p.text()`. Cancellation is checked earlier but the type isn't narrowed. Works in practice but unsound.

---

### 14. `src/index.ts:180-186` — Fallthrough exits code 0

```ts
if (handler) { ... }
process.exit(0);
```

If `handler` is falsy (unreachable due to arg validation, but not guarded), the process silently exits 0 instead of non-zero.

---

## Low Priority

### 15. `src/core/config.ts:7` — `defaultFlow` is a single-value type

```ts
defaultFlow: "deployAll";
```

This union has only one member. Either extend it with real flow names or remove it.

---

### 16. `src/index.ts:130-131` — Redundant verbose/json fields

`context.verbose` and `context.json` duplicate `context.config.output.verbose` / `context.config.output.json`. Could simplify to just read from `context.config.output`.

---

### 17. `src/core/android.ts:312` — `getLanIp` picks first non-internal IPv4

With Docker, VPNs, or multiple NICs, returns the wrong IP. Should prefer the interface used for default route.

---

### 18. `src/core/state.ts` — State persisted in project directory

`.shg/state.json` is stored in the project root. Problematic on shared filesystems, CI, or read-only directories.

---

## Testing Gaps

- No test for `runBuild` with `--flavor` (would catch bug #1)
- No test for `getLanIp` failure in `dev` (would catch bug #4)
- No test for `updateCapacitorConfig` with TS/single-quote configs
- No integration test for `deploy --json` forwarding flags to doctor

---

## Toil / DX Issues

- Hard-coded `bun` everywhere — no detection of `npm`/`yarn`/`pnpm` package manager
- `executor.ts` has no timeout for hung commands
- No `.prettierrc` or `.editorconfig` despite `CONTRIBUTING.md` mentioning style consistency
- `tsconfig.json` has `strict: true` but several `as` casts and `!` assertions bypass it

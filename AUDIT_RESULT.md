# SHG Audit Result

Date: 2026-08-23
Scope: CLI source, documentation website, command behavior, and Windows portability.

## Bottom line

The audited defects have been fixed in the working tree. SHG is buildable, the repaired behaviors have regression coverage, and Windows-specific command paths are handled. A real Windows Android build still needs to be exercised on a Windows host because this environment is Linux-only.

## Verification

- `bun test`: 154 passed, 0 failed
- `bun run typecheck`: passed
- `bun run build`: passed
- `web`: lint and production build passed

## Changes made for Windows

- Bundled platform-tools now adds `~/.shg/bin` to the current process `PATH`.
- Windows uses `.exe` targets and falls back from symlink creation to copying into Bun’s bin directory.
- Platform-tools extraction explicitly uses `powershell.exe`.
- Android builds invoke an absolute `gradlew.bat`/`gradlew` path instead of relying on shell working-directory lookup.
- LAN adapter selection recognizes Windows names such as `Wi-Fi` and `Ethernet`.
- README now documents Windows setup and the Bun requirement for wrapped project commands.

## Fixed findings

### `deploy --build` now builds Android output

The deploy build step now delegates to the Android build handler, including web build, Capacitor sync, and the correct Gradle task. Duplicate sync is skipped when the build already performed it.

### Saved variants are now reused by `shg run`

State is now consulted before the default variant, so a saved release/flavor/device selection is honored unless the user supplies a CLI override.

### Wi-Fi endpoint verification is exact

ADB connection verification now requires the exact host and port, preventing another device on the same port from being mistaken for the requested device.

### Capacitor config reading is comment-safe and supports static TS/JS values

The reader now masks comments, supports quoted/static template values and simple variables, and rejects computed values instead of returning misleading text. Version discovery uses the same safe extractor.

### LAN and device IP selection is route-aware

The host now prefers the system default route, supports Windows `route.exe`, and falls back to filtered adapter selection. Android device IP discovery first checks the device’s active route instead of taking the first interface.

### Command execution is bounded

Commands now have a five-minute default timeout, with explicit opt-outs for long-running logcat and live-reload processes and shorter timeouts for ADB discovery/connectivity calls.

## Remaining validation

The repository still does not have a real-device, real-Gradle, or Windows CI job. Those are environment validation gaps rather than unaddressed findings in the source. The CLI workflow commands require Bun, which is now stated explicitly in the prerequisites.

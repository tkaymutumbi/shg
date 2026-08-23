import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

export function collectApks(apkRoot: string): string[] {
  if (!existsSync(apkRoot)) return [];

  const files: string[] = [];
  const stack = [apkRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".apk")) files.push(fullPath);
    }
  }
  return files;
}

export function selectApkForVariant(
  files: string[],
  apkRoot: string,
  variant: string,
  flavor = "",
): string | undefined {
  const normalizedVariant = variant.toLowerCase();
  const normalizedFlavor = flavor.toLowerCase();
  const matches = files.filter((file) => {
    const relativePath = relative(apkRoot, file);
    const segments = relativePath.split(sep).map((segment) => segment.toLowerCase());
    const directories = segments.slice(0, -1);
    const fileName = basename(file).toLowerCase();
    if (!fileName.endsWith(".apk") || /androidtest|unaligned|unsigned/i.test(file)) return false;
    if (!directories.includes(normalizedVariant)) return false;
    if (normalizedFlavor && !directories.includes(normalizedFlavor)) return false;
    // Without --flavor, never guess a product flavor when a plain variant APK
    // is unavailable. That avoids silently installing the wrong application.
    if (!normalizedFlavor && directories.length !== 1) return false;
    return true;
  });

  return matches.sort((left, right) => left.localeCompare(right))[0];
}

export function findBuiltApk(projectRoot: string, variant: string, flavor = ""): string | undefined {
  const apkRoot = join(projectRoot, "android", "app", "build", "outputs", "apk");
  return selectApkForVariant(collectApks(apkRoot), apkRoot, variant, flavor);
}

export function isAndroidAppBundle(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".aab");
}

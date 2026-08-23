import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface AssetSource {
  path: string;
  kind: "svg" | "png" | "jpeg";
  copiedFrom?: string;
}

export interface AssetSourceCheck {
  source?: AssetSource;
  error?: string;
  checkedPaths: string[];
}

const SOURCE_NAMES = ["icon.png", "icon.jpg", "icon.jpeg", "icon.svg"] as const;

function imageKind(path: string, data: Buffer): AssetSource["kind"] | undefined {
  if (path.toLowerCase().endsWith(".svg")) return "svg";
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  return undefined;
}

function validateImage(path: string): AssetSource | string {
  let data: Buffer;
  try {
    const stats = statSync(path);
    if (!stats.isFile() || stats.size === 0) return "file is empty or not a regular file";
    data = readFileSync(path);
  } catch {
    return "file could not be read";
  }

  const kind = imageKind(path, data);
  if (!kind) return "unsupported or corrupted image format (expected SVG, PNG, or JPEG)";

  if (kind === "svg") {
    const source = data.toString("utf8");
    if (!/<svg\b[^>]*>/i.test(source) || !/<\/svg\s*>/i.test(source)) {
      return "SVG does not contain a complete <svg> document";
    }
    if (/<(?:image|use)\b[^>]*(?:href|xlink:href)\s*=\s*["'](?!data:)[^"']+/i.test(source)) {
      return "SVG references an external image dependency; embed it or use a self-contained icon";
    }
  }

  if (kind === "png" && data.length >= 24) {
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    if (width === 0 || height === 0) return "PNG has zero width or height";
  }

  return { path, kind };
}

export function prepareAssetSource(projectRoot: string): AssetSourceCheck {
  const assetDir = join(projectRoot, "assets");
  const checkedPaths: string[] = [];
  const existingAssetSources = SOURCE_NAMES.map((name) => join(assetDir, name)).filter((path) => existsSync(path));

  for (const path of existingAssetSources) {
    checkedPaths.push(path);
    const result = validateImage(path);
    if (typeof result === "string") {
      return { checkedPaths, error: `Asset source ${path} is broken: ${result}.` };
    }
    return { checkedPaths, source: result };
  }

  const projectSources = SOURCE_NAMES
    .flatMap((name) => [join(projectRoot, "public", name), join(projectRoot, name)])
    .filter((path) => existsSync(path));
  checkedPaths.push(...projectSources);

  for (const path of projectSources) {
    const result = validateImage(path);
    if (typeof result === "string") {
      return { checkedPaths, error: `Project icon source ${path} is broken: ${result}.` };
    }

    mkdirSync(assetDir, { recursive: true });
    const target = join(assetDir, `icon.${result.kind === "jpeg" ? "jpg" : result.kind}`);
    try {
      copyFileSync(path, target);
    } catch {
      return { checkedPaths, error: `Could not copy project icon source ${path} to ${target}.` };
    }
    return { checkedPaths, source: { ...result, path: target, copiedFrom: path } };
  }

  return {
    checkedPaths,
    error: `No app icon source found. Add assets/icon.png (or icon.svg), or provide public/icon.svg/icon.png so SHG can copy it into assets/.`,
  };
}

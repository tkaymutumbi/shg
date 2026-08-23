import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extractStaticConfigValue, readAppId, readWebDir } from "../project.js";

const tempProjects: string[] = [];

afterEach(() => {
  for (const project of tempProjects.splice(0)) {
    rmSync(project, { recursive: true, force: true });
  }
});

function makeProject(config: string): string {
  const project = mkdtempSync(join(tmpdir(), "shg-project-"));
  writeFileSync(join(project, "capacitor.config.ts"), config);
  tempProjects.push(project);
  return project;
}

describe("Capacitor config value reading", () => {
  test("ignores comments and reads static template literals", () => {
    const project = makeProject(`// appId: "wrong.example"\nexport default {
      appId: "com.example.real",
      webDir: \`build\`,
    };\n`);

    expect(readAppId(project)).toBe("com.example.real");
    expect(readWebDir(project)).toBe("build");
  });

  test("resolves simple static variables", () => {
    const project = makeProject(`const appId = "com.example.variable";
const webDir = "dist-custom";
export default { appId, webDir };\n`);

    expect(readAppId(project)).toBe("com.example.variable");
    expect(readWebDir(project)).toBe("dist-custom");
  });

  test("rejects computed values instead of returning source text", () => {
    expect(extractStaticConfigValue("export default { webDir: process.env.WEB_DIR };", "webDir")).toBeUndefined();
  });
});

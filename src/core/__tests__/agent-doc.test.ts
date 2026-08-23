import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureAgentDoc } from "../agent-doc.js";
import { findWorkspaceRoot } from "../project.js";

describe("SHG agent instructions", () => {
  test("installs a discoverable playbook and preserves existing instructions", () => {
    const root = mkdtempSync(join(tmpdir(), "shg-agent-doc-"));
    writeFileSync(join(root, "AGENTS.md"), "# Existing rules\n\nKeep this text.\n");

    ensureAgentDoc(root);
    ensureAgentDoc(root);

    const rootDoc = readFileSync(join(root, "AGENTS.md"), "utf8");
    const playbook = readFileSync(join(root, ".shg", "AGENTS.md"), "utf8");
    expect(rootDoc).toContain("# Existing rules");
    expect(rootDoc).toContain("Keep this text.");
    expect(rootDoc.match(/shg-agent-instructions:start/g)?.length).toBe(1);
    expect(rootDoc).toContain(".shg/AGENTS.md");
    expect(playbook).toContain("How to help the user");
    expect(playbook).toContain("shg devices --wifi");
    expect(playbook).toContain("shg device status");

    rmSync(root, { recursive: true, force: true });
  });

  test("finds a non-Capacitor package workspace from a child directory", () => {
    const root = mkdtempSync(join(tmpdir(), "shg-workspace-"));
    const child = join(root, "src", "components");
    mkdirSync(child, { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");

    expect(findWorkspaceRoot(child)).toBe(root);

    rmSync(root, { recursive: true, force: true });
  });
});

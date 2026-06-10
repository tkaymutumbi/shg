import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readJsonFile, writeJsonFile } from "../fsjson.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "shg-fsjson-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("writeJsonFile", () => {
  test("writes JSON with 2-space indent and trailing newline", () => {
    const filePath = join(tmpDir, "config.json");
    writeJsonFile(filePath, { name: "test", count: 42 });
    const content = readFileSync(filePath, "utf8");
    expect(content).toBe('{\n  "name": "test",\n  "count": 42\n}\n');
  });

  test("creates parent directories if missing", () => {
    const filePath = join(tmpDir, "nested", "deep", "config.json");
    writeJsonFile(filePath, { ok: true });
    expect(existsSync(filePath)).toBe(true);
  });

  test("overwrites existing file", () => {
    const filePath = join(tmpDir, "data.json");
    writeJsonFile(filePath, { v: 1 });
    writeJsonFile(filePath, { v: 2 });
    const data = readJsonFile<{ v: number }>(filePath);
    expect(data?.v).toBe(2);
  });
});

describe("readJsonFile", () => {
  test("reads valid JSON file", () => {
    const filePath = join(tmpDir, "valid.json");
    writeFileSync(filePath, '{"hello":"world"}', "utf8");
    const data = readJsonFile<{ hello: string }>(filePath);
    expect(data?.hello).toBe("world");
  });

  test("returns undefined for missing file", () => {
    const result = readJsonFile(join(tmpDir, "nonexistent.json"));
    expect(result).toBeUndefined();
  });

  test("returns undefined for malformed JSON", () => {
    const filePath = join(tmpDir, "bad.json");
    writeFileSync(filePath, "{invalid}", "utf8");
    const result = readJsonFile(filePath);
    expect(result).toBeUndefined();
  });

  test("returns undefined for empty file", () => {
    const filePath = join(tmpDir, "empty.json");
    writeFileSync(filePath, "", "utf8");
    const result = readJsonFile(filePath);
    expect(result).toBeUndefined();
  });
});

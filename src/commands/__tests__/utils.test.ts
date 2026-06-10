import { describe, expect, test, mock } from "bun:test";
import { selectedDeploySteps } from "../deploy.js";
import { capitalize } from "../build.js";
import { getFilter } from "../logs.js";
import { getStringFlag } from "../run.js";
import { getCleanTargets } from "../clean.js";
import { formatAppName, sanitizePackageName } from "../create.js";
import { parseValue, setDeepValue } from "../config.js";
import { statusIcon } from "../doctor.js";

describe("selectedDeploySteps", () => {
  test("--all returns all steps", () => {
    expect(selectedDeploySteps({ all: true })).toEqual(["build", "sync", "run"]);
  });

  test("individual flags", () => {
    expect(selectedDeploySteps({ build: true })).toEqual(["build"]);
    expect(selectedDeploySteps({ sync: true })).toEqual(["sync"]);
    expect(selectedDeploySteps({ run: true })).toEqual(["run"]);
  });

  test("multiple individual flags", () => {
    expect(selectedDeploySteps({ build: true, sync: true })).toEqual(["build", "sync"]);
  });

  test("no flags defaults to all", () => {
    expect(selectedDeploySteps({})).toEqual(["build", "sync", "run"]);
  });
});

describe("capitalize", () => {
  test("capitalizes lowercase", () => expect(capitalize("debug")).toBe("Debug"));
  test("capitalizes release", () => expect(capitalize("release")).toBe("Release"));
  test("handles empty string", () => expect(capitalize("")).toBe(""));
  test("already capitalized", () => expect(capitalize("Debug")).toBe("Debug"));
});

describe("getFilter", () => {
  test("default filter", () => expect(getFilter()).toBe("Capacitor:D"));
  test("custom tag default level", () => expect(getFilter("MyTag")).toBe("MyTag:D"));
  test("custom tag and level", () => expect(getFilter("MyTag", "E")).toBe("MyTag:E"));
  test("level only without tag", () => expect(getFilter(undefined, "W")).toBe("Capacitor:W"));
});

describe("getStringFlag", () => {
  test("returns string value", () => expect(getStringFlag({ device: "foo" }, "device")).toBe("foo"));
  test("returns undefined for boolean", () => expect(getStringFlag({ verbose: true }, "verbose")).toBeUndefined());
  test("returns undefined for missing key", () => expect(getStringFlag({}, "device")).toBeUndefined());
});

describe("getCleanTargets", () => {
  const targets = getCleanTargets("/project");
  test("returns 5 targets", () => expect(targets).toHaveLength(5));
  test("includes android build", () => expect(targets[0].path).toContain("android/build"));
  test("includes dist", () => expect(targets[3].path).toContain("dist"));
  test("includes www", () => expect(targets[4].label).toBe("Capacitor web assets"));
});

describe("formatAppName", () => {
  test("kebab-case", () => expect(formatAppName("my-app")).toBe("My App"));
  test("snake_case", () => expect(formatAppName("hello_world")).toBe("Hello World"));
  test("dot.separated", () => expect(formatAppName("my.app")).toBe("My App"));
  test("already formatted", () => expect(formatAppName("MyApp")).toBe("MyApp"));
  test("empty string", () => expect(formatAppName("")).toBe(""));
});

describe("sanitizePackageName", () => {
  test("lowercases", () => expect(sanitizePackageName("MyApp")).toBe("myapp"));
  test("strips special chars", () => expect(sanitizePackageName("hello-world!@#")).toBe("helloworld"));
  test("falls back to app", () => expect(sanitizePackageName("!!!")).toBe("app"));
  test("preserves alphanumeric", () => expect(sanitizePackageName("app123")).toBe("app123"));
});

describe("parseValue", () => {
  test("true string", () => expect(parseValue("true")).toBe(true));
  test("false string", () => expect(parseValue("false")).toBe(false));
  test("numeric string", () => expect(parseValue("42")).toBe(42));
  test("zero", () => expect(parseValue("0")).toBe(0));
  test("string value", () => expect(parseValue("hello")).toBe("hello"));
  test("empty string", () => expect(parseValue("")).toBe(""));
});

describe("setDeepValue", () => {
  test("sets top-level key", () => {
    const obj: Record<string, unknown> = {};
    setDeepValue(obj, "name", "test");
    expect(obj.name).toBe("test");
  });

  test("sets nested key", () => {
    const obj: Record<string, unknown> = {};
    setDeepValue(obj, "output.verbose", true);
    expect((obj.output as Record<string, unknown>).verbose).toBe(true);
  });

  test("sets deeply nested key", () => {
    const obj: Record<string, unknown> = {};
    setDeepValue(obj, "a.b.c", 1);
    expect(((obj.a as Record<string, unknown>).b as Record<string, unknown>).c).toBe(1);
  });

  test("preserves existing keys", () => {
    const obj: Record<string, unknown> = { existing: true };
    setDeepValue(obj, "newKey", "val");
    expect(obj.existing).toBe(true);
    expect(obj.newKey).toBe("val");
  });

  test("merges into existing nested object", () => {
    const obj: Record<string, unknown> = { output: { json: false } };
    setDeepValue(obj, "output.verbose", true);
    expect((obj.output as Record<string, unknown>).json).toBe(false);
    expect((obj.output as Record<string, unknown>).verbose).toBe(true);
  });
});

describe("statusIcon", () => {
  test("pass returns green check", () => expect(statusIcon("pass")).toMatch(/✔/));
  test("warn returns yellow exclamation", () => expect(statusIcon("warn")).toMatch(/!/));
  test("fail returns red x", () => expect(statusIcon("fail")).toMatch(/✘/));
});

describe("isCancelled", () => {
  const clackCancelSymbol = Symbol("clack:cancel");

  test("clack cancel symbol returns true", async () => {
    mock.module("@clack/prompts", () => ({
      isCancel: (val: unknown) => val === clackCancelSymbol,
      cancel: () => {},
    }));
    const { isCancelled } = await import("../../interactive.js");
    expect(isCancelled(clackCancelSymbol)).toBe(true);
  });

  test("generic symbol returns false", async () => {
    const { isCancelled } = await import("../../interactive.js");
    expect(isCancelled(Symbol())).toBe(false);
  });

  test("string returns false", async () => {
    const { isCancelled } = await import("../../interactive.js");
    expect(isCancelled("hello" as unknown as symbol)).toBe(false);
  });

  test("number returns false", async () => {
    const { isCancelled } = await import("../../interactive.js");
    expect(isCancelled(42 as unknown as symbol)).toBe(false);
  });

  test("undefined returns false", async () => {
    const { isCancelled } = await import("../../interactive.js");
    expect(isCancelled(undefined as unknown as symbol)).toBe(false);
  });
});

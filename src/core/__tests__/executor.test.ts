import { describe, expect, test, mock } from "bun:test";

const mockExeca = mock(async () => ({
  exitCode: 0,
  stdout: "mocked stdout",
  stderr: "",
}));

mock.module("execa", () => ({
  execa: mockExeca,
}));

const { runCommand } = await import("../executor.js");

describe("runCommand", () => {
  test("returns success on exitCode 0", async () => {
    const result = await runCommand(
      { label: "test", cmd: "echo", args: ["hello"] },
      { stdio: "pipe" },
    );
    expect(result.success).toBe(true);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("mocked stdout");
  });

  test("returns failure on non-zero exitCode", async () => {
    mockExeca.mockImplementationOnce(async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "error occurred",
    }));

    const result = await runCommand(
      { label: "fail", cmd: "false", args: [] },
      { stdio: "pipe" },
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
  });

  test("handles thrown error", async () => {
    mockExeca.mockImplementationOnce(async () => {
      throw new Error("command not found");
    });

    const result = await runCommand(
      { label: "missing", cmd: "nonexistent", args: [] },
      { stdio: "pipe" },
    );
    expect(result.success).toBe(false);
    expect(result.code).toBe(1);
    expect(result.errorMessage).toBe("command not found");
  });

  test("passes cwd and env to execa", async () => {
    await runCommand(
      { label: "test", cmd: "pwd", args: [], cwd: "/tmp", env: { FOO: "bar" } },
      { stdio: "pipe" },
    );

    expect(mockExeca).toHaveBeenCalledWith("pwd", [], {
      cwd: "/tmp",
      stdio: "pipe",
      reject: false,
      env: { FOO: "bar" },
      timeout: 300000,
    });
  });

  test("allows intentionally long-running commands to disable the timeout", async () => {
    await runCommand(
      { label: "logcat", cmd: "adb", args: ["logcat"], timeout: 0 },
      { stdio: "pipe" },
    );

    expect(mockExeca).toHaveBeenLastCalledWith("adb", ["logcat"], {
      cwd: undefined,
      stdio: "pipe",
      reject: false,
      env: undefined,
      timeout: undefined,
    });
  });
});

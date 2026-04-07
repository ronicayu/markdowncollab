import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll test the env-check logic by importing a testable version
// Since the module calls process.exit, we need to mock that

describe("env-check", () => {
  let originalEnv;
  let mockExit;
  let mockConsoleLog;
  let mockConsoleError;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    // Clear module cache so re-import works fresh
    vi.resetModules();
  });

  it("exits if DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test-secret";

    const { validateEnv } = await import("./env-check.mjs");
    expect(() => validateEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("exits if NEXTAUTH_SECRET is missing", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    delete process.env.NEXTAUTH_SECRET;

    const { validateEnv } = await import("./env-check.mjs");
    expect(() => validateEnv()).toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("succeeds when required vars are present", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    process.env.NEXTAUTH_SECRET = "test-secret";
    process.env.ANTHROPIC_API_KEY = "sk-test";
    process.env.GOOGLE_CLIENT_ID = "gid";
    process.env.GOOGLE_CLIENT_SECRET = "gsecret";

    const { validateEnv } = await import("./env-check.mjs");
    validateEnv(); // should not throw
    expect(mockExit).not.toHaveBeenCalled();
  });

  it("warns about missing optional vars but does not exit", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    process.env.NEXTAUTH_SECRET = "test-secret";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const { validateEnv } = await import("./env-check.mjs");
    validateEnv(); // should not throw
    expect(mockExit).not.toHaveBeenCalled();
    // Should have printed warnings
    const logCalls = mockConsoleLog.mock.calls.flat().join(" ");
    expect(logCalls).toContain("ANTHROPIC_API_KEY");
    expect(logCalls).toContain("GOOGLE_CLIENT_ID");
  });
});

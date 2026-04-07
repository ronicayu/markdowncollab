import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, resetRateLimits } from "../rate-limiter";

beforeEach(() => {
  resetRateLimits();
  vi.restoreAllMocks();
});

describe("checkRateLimit", () => {
  it("allows the first request", () => {
    const result = checkRateLimit("user-1", 5, 720_000);
    expect(result.allowed).toBe(true);
  });

  it("allows up to maxTokens requests", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("user-2", 5, 720_000);
      expect(result.allowed).toBe(true);
    }
  });

  it("rejects when tokens are exhausted", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-3", 5, 720_000);
    }
    const result = checkRateLimit("user-3", 5, 720_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it("refills tokens after the interval", () => {
    // Exhaust tokens
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-4", 5, 1000);
    }
    expect(checkRateLimit("user-4", 5, 1000).allowed).toBe(false);

    // Advance time by 1 interval
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1001);
    const result = checkRateLimit("user-4", 5, 1000);
    expect(result.allowed).toBe(true);
  });

  it("tracks different keys independently", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("alice", 3, 60_000);
    }
    expect(checkRateLimit("alice", 3, 60_000).allowed).toBe(false);
    expect(checkRateLimit("bob", 3, 60_000).allowed).toBe(true);
  });

  it("returns retryAfter in seconds", () => {
    for (let i = 0; i < 2; i++) {
      checkRateLimit("user-5", 2, 60_000);
    }
    const result = checkRateLimit("user-5", 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(typeof result.retryAfter).toBe("number");
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("never refills above maxTokens", () => {
    checkRateLimit("user-6", 3, 100);
    // Advance far in the future
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1_000_000);
    // Should be capped at 3, so 3 more requests should work then fail
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("user-6", 3, 100).allowed).toBe(true);
    }
    expect(checkRateLimit("user-6", 3, 100).allowed).toBe(false);
  });
});

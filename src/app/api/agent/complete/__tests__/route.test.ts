import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
}));

class MockAnthropic {
  messages = {
    create: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "AI completion text" }],
    }),
  };
}
vi.mock("@anthropic-ai/sdk", () => ({
  default: MockAnthropic,
}));

import { getServerSession } from "next-auth";
import { checkRateLimit } from "@/lib/rate-limiter";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckRateLimit = vi.mocked(checkRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});

describe("POST /api/agent/complete", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello world test" }),
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 3 });

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello world test" }),
      }) as any
    );
    expect(res.status).toBe(429);
  });

  it("returns completion when authenticated", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello world test" }),
      }) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.completion).toBeDefined();
  });
});

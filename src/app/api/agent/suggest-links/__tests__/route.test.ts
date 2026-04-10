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

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockFindMany = vi.mocked(prisma.document.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});

describe("POST /api/agent/suggest-links", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/suggest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: "doc-1" }),
      }) as any
    );
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckRateLimit.mockReturnValue({ allowed: false, retryAfter: 2 });

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/suggest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: "doc-1" }),
      }) as any
    );
    expect(res.status).toBe(429);
  });

  it("returns suggestions when authenticated", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockFindUnique.mockResolvedValue({
      id: "doc-1",
      title: "JavaScript Testing Guide",
    } as any);
    mockFindMany.mockResolvedValue([
      { id: "doc-2", title: "JavaScript Best Practices" },
      { id: "doc-3", title: "Python Testing Guide" },
    ] as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost/api/agent/suggest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: "doc-1" }),
      }) as any
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toBeDefined();
    expect(Array.isArray(body.suggestions)).toBe(true);
  });
});

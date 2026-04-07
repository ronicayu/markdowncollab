import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    webhook: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockWebhookFindMany = vi.mocked(prisma.webhook.findMany);
const mockWebhookFindUnique = vi.mocked(prisma.webhook.findUnique);
const mockWebhookCreate = vi.mocked(prisma.webhook.create);
const mockWebhookDelete = vi.mocked(prisma.webhook.delete);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Test User" },
    expires: "never",
  } as any);
});

describe("GET /api/webhooks", () => {
  it("returns webhooks for authenticated user", async () => {
    mockWebhookFindMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hook",
        events: "document.edited,comment.created",
        ownerId: "user-1",
        active: true,
        createdAt: new Date(),
      },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].url).toBe("https://example.com/hook");
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks", () => {
  it("creates a webhook with valid URL", async () => {
    mockWebhookCreate.mockResolvedValue({
      id: "wh-new",
      url: "https://example.com/hook",
      events: "document.edited",
      ownerId: "user-1",
      active: true,
      createdAt: new Date(),
    } as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook", events: "document.edited" }),
      })
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.url).toBe("https://example.com/hook");
  });

  it("rejects invalid URL", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("rejects missing URL", async () => {
    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/hook" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/webhooks", () => {
  it("deletes own webhook", async () => {
    mockWebhookFindUnique.mockResolvedValue({
      id: "wh-1",
      ownerId: "user-1",
      url: "https://example.com/hook",
      events: "*",
      active: true,
      createdAt: new Date(),
    } as any);
    mockWebhookDelete.mockResolvedValue({} as any);

    const { DELETE } = await import("../route");
    const res = await DELETE(
      new Request("http://localhost", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "wh-1" }),
      })
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("returns 404 for other user webhook", async () => {
    mockWebhookFindUnique.mockResolvedValue({
      id: "wh-1",
      ownerId: "user-2",
      url: "https://example.com/hook",
      events: "*",
      active: true,
      createdAt: new Date(),
    } as any);

    const { DELETE } = await import("../route");
    const res = await DELETE(
      new Request("http://localhost", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "wh-1" }),
      })
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const res = await DELETE(
      new Request("http://localhost", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "wh-1" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

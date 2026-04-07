import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    snippet: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockGetServerSession = vi.mocked(getServerSession);
const mockFindMany = vi.mocked(prisma.snippet.findMany);
const mockCreate = vi.mocked(prisma.snippet.create);
const mockFindFirst = vi.mocked(prisma.snippet.findFirst);
const mockDelete = vi.mocked(prisma.snippet.delete);

function mockSession(userId: string | null) {
  if (!userId) {
    mockGetServerSession.mockResolvedValue(null);
  } else {
    mockGetServerSession.mockResolvedValue({
      user: { id: userId, name: "Test User", email: "test@test.com" },
    } as any);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("GET /api/snippets", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns user snippets", async () => {
    mockSession("user-1");
    mockFindMany.mockResolvedValue([
      { id: "s1", title: "Hello", content: "World", ownerId: "user-1", createdAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("Hello");
  });
});

describe("POST /api/snippets", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "T", content: "C" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it("creates a snippet", async () => {
    mockSession("user-1");
    mockCreate.mockResolvedValue({
      id: "s-new",
      title: "My Snippet",
      content: "Some content",
      ownerId: "user-1",
      createdAt: new Date(),
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Snippet", content: "Some content" }),
    });
    const res = await POST(req as any);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.title).toBe("My Snippet");
  });

  it("returns 400 when title is missing", async () => {
    mockSession("user-1");
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "C" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it("returns 400 when content is missing", async () => {
    mockSession("user-1");
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "T" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/snippets", () => {
  it("returns 401 when not authenticated", async () => {
    mockSession(null);
    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "s1" }),
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it("deletes a snippet owned by the user", async () => {
    mockSession("user-1");
    mockFindFirst.mockResolvedValue({
      id: "s1",
      title: "T",
      content: "C",
      ownerId: "user-1",
      createdAt: new Date(),
    } as any);
    mockDelete.mockResolvedValue({} as any);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "s1" }),
    });
    const res = await DELETE(req as any);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
  });

  it("returns 404 when snippet not found or not owned", async () => {
    mockSession("user-1");
    mockFindFirst.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "s-other" }),
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);
  });

  it("returns 400 when id is missing", async () => {
    mockSession("user-1");
    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/snippets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(400);
  });
});

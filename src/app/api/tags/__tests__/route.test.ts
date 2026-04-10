import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockTagFindFirst = vi.mocked(prisma.tag.findFirst);
const mockTagCreate = vi.mocked(prisma.tag.create);
const mockGetSession = vi.mocked(getServerSession);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: authenticated user
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Alice" },
    expires: "never",
  } as any);
});

describe("GET /api/tags", () => {
  it("returns all tags sorted by name", async () => {
    mockTagFindMany.mockResolvedValue([
      { id: "t1", name: "Bug", color: "#ef4444" },
      { id: "t2", name: "Feature", color: "#3b82f6" },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Bug");
    expect(data[1].name).toBe("Feature");
  });

  it("returns empty array when no tags exist", async () => {
    mockTagFindMany.mockResolvedValue([]);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(0);
  });
});

describe("POST /api/tags", () => {
  it("creates a new tag", async () => {
    mockTagFindFirst.mockResolvedValue(null);
    mockTagCreate.mockResolvedValue({
      id: "t-new",
      name: "Urgent",
      color: "#ef4444",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Urgent", color: "#ef4444" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Urgent");
    expect(data.color).toBe("#ef4444");
  });

  it("returns existing tag if name already exists", async () => {
    mockTagFindFirst.mockResolvedValue({
      id: "t-existing",
      name: "Bug",
      color: "#ef4444",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bug" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("t-existing");
  });

  it("returns 400 when name is missing", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when name is empty string", async () => {
    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("uses default color when not provided", async () => {
    mockTagFindFirst.mockResolvedValue(null);
    mockTagCreate.mockResolvedValue({
      id: "t-new",
      name: "Todo",
      color: "#6b7280",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Todo" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockTagCreate).toHaveBeenCalledWith({
      data: { name: "Todo", color: "#6b7280" },
    });
  });
});

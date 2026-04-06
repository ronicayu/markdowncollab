import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentShare: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);
const mockShareFindMany = vi.mocked(prisma.documentShare.findMany);
const mockShareCreate = vi.mocked(prisma.documentShare.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Owner" },
    expires: "never",
  } as any);
});

const params = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]/share", () => {
  it("returns shares list for owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareFindMany.mockResolvedValue([
      { id: "s1", documentId: "doc-1", userId: null, email: "b@c.com", role: "viewer", shareToken: null, createdAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost"), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("returns 403 for non-owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: false, role: "editor" });

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/documents/[id]/share", () => {
  it("creates a share for owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareCreate.mockResolvedValue({
      id: "s-new",
      documentId: "doc-1",
      userId: null,
      email: "new@user.com",
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@user.com", role: "editor" }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.email).toBe("new@user.com");
  });

  it("rejects invalid role", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "x@y.com", role: "admin" }),
      }),
      { params }
    );
    expect(res.status).toBe(400);
  });
});

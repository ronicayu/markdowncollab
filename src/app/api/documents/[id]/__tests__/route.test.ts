import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    unlink: vi.fn().mockResolvedValue(undefined),
  };
});

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);
const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockUpdate = vi.mocked(prisma.document.update);
const mockDelete = vi.mocked(prisma.document.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

const params = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]", () => {
  it("returns 403 when user has no access", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: false, role: null });

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/documents/doc-1"), { params });
    expect(res.status).toBe(403);
  });

  it("returns document with role when user has access", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "editor" });
    mockFindUnique.mockResolvedValue({
      id: "doc-1",
      title: "Test",
      ownerId: "other",
      visibility: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/documents/doc-1"), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.role).toBe("editor");
  });
});

describe("DELETE /api/documents/[id]", () => {
  it("returns 403 when user is not owner", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: false, role: "editor" });

    const { DELETE } = await import("../route");
    const res = await DELETE(new Request("http://localhost/api/documents/doc-1"), { params });
    expect(res.status).toBe(403);
  });
});

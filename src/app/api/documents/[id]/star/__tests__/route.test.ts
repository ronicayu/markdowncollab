import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentStar: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
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

const mockGetSession = vi.mocked(getServerSession);
const mockDocFindUnique = vi.mocked(prisma.document.findUnique);
const mockStarFindUnique = vi.mocked(prisma.documentStar.findUnique);
const mockStarCreate = vi.mocked(prisma.documentStar.create);
const mockStarDelete = vi.mocked(prisma.documentStar.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/documents/[id]/star", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("../../star/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when document does not exist", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);
    mockDocFindUnique.mockResolvedValue(null);

    const { POST } = await import("../../star/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
  });

  it("creates a star when none exists", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);
    mockDocFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockStarFindUnique.mockResolvedValue(null);
    mockStarCreate.mockResolvedValue({ id: "star-1", documentId: "doc-1", userId: "user-1" } as any);

    const { POST } = await import("../../star/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    const data = await res.json();

    expect(data.starred).toBe(true);
    expect(mockStarCreate).toHaveBeenCalled();
  });

  it("removes a star when one exists (toggle off)", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);
    mockDocFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockStarFindUnique.mockResolvedValue({
      id: "star-1",
      documentId: "doc-1",
      userId: "user-1",
    } as any);
    mockStarDelete.mockResolvedValue({ id: "star-1" } as any);

    const { POST } = await import("../../star/route");
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "doc-1" }),
    });
    const data = await res.json();

    expect(data.starred).toBe(false);
    expect(mockStarDelete).toHaveBeenCalled();
  });
});

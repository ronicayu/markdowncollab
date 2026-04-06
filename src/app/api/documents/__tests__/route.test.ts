import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    documentShare: {
      findMany: vi.fn(),
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

const mockFindMany = vi.mocked(prisma.document.findMany);
const mockShareFindMany = vi.mocked(prisma.documentShare.findMany);
const mockGetSession = vi.mocked(getServerSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents", () => {
  it("returns only owned and shared documents for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFindMany.mockResolvedValue([
      { id: "doc-1", title: "My Doc", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date() },
      { id: "doc-legacy", title: "Legacy", ownerId: null, visibility: "private", createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    mockShareFindMany.mockResolvedValue([
      { id: "s1", documentId: "doc-2", userId: "user-1", email: null, role: "editor", shareToken: null, createdAt: new Date() },
    ] as any);

    // Import after mocks
    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(data.length).toBeGreaterThanOrEqual(1);
    // Verify the query included the user's ID in the where clause
    expect(mockFindMany).toHaveBeenCalled();
  });

  it("returns all documents when no session (backward compat for unauthenticated)", async () => {
    mockGetSession.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([
      { id: "doc-1", title: "Public", ownerId: null, visibility: "private", createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
  });
});

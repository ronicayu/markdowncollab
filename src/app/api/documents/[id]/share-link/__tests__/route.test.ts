import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
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
const mockDocUpdate = vi.mocked(prisma.document.update);
const mockShareCreate = vi.mocked(prisma.documentShare.create);
const mockShareDeleteMany = vi.mocked(prisma.documentShare.deleteMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Owner" },
    expires: "never",
  } as any);
});

const params = Promise.resolve({ id: "doc-1" });

describe("POST /api/documents/[id]/share-link", () => {
  it("enables link sharing and returns a token", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareCreate.mockImplementation(async ({ data }: any) => ({
      id: "share-link-1",
      documentId: "doc-1",
      userId: null,
      email: null,
      role: data.role,
      shareToken: data.shareToken,
      createdAt: new Date(),
    }));
    mockDocUpdate.mockResolvedValue({} as any);
    mockShareDeleteMany.mockResolvedValue({ count: 0 } as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, role: "viewer" }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.shareToken).toBeTruthy();
    expect(data.role).toBe("viewer");
  });

  it("disables link sharing", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareDeleteMany.mockResolvedValue({ count: 1 } as any);
    mockDocUpdate.mockResolvedValue({} as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.shareToken).toBeNull();
  });
});

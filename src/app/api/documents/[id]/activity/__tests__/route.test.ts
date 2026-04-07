import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: {
      findMany: vi.fn(),
      count: vi.fn(),
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
const mockFindMany = vi.mocked(prisma.activityLog.findMany);
const mockCount = vi.mocked(prisma.activityLog.count);

// Dynamic import so mocks are in place first
const { GET } = await import("../../activity/route");

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Owner" },
    expires: "never",
  } as any);
});

describe("GET /api/documents/[id]/activity", () => {
  it("returns 403 when user lacks access", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: false } as any);

    const req = new Request("http://localhost/api/documents/doc-1/activity");
    const res = await GET(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(403);
  });

  it("returns paginated activity list", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" } as any);

    const activities = [
      {
        id: "act-1",
        documentId: "doc-1",
        userId: "user-1",
        userName: "Owner",
        action: "shared",
        detail: "Shared with bob@test.com as editor",
        createdAt: new Date("2026-04-06T10:00:00Z"),
      },
      {
        id: "act-2",
        documentId: "doc-1",
        userId: "user-1",
        userName: "Owner",
        action: "restored_version",
        detail: "Restored to version from Apr 5",
        createdAt: new Date("2026-04-06T09:00:00Z"),
      },
    ];

    mockFindMany.mockResolvedValue(activities as any);
    mockCount.mockResolvedValue(2);

    const req = new Request("http://localhost/api/documents/doc-1/activity?page=1");
    const res = await GET(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.activities).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("defaults to page 1 when no page param", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" } as any);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/documents/doc-1/activity");
    const res = await GET(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.page).toBe(1);
    expect(data.activities).toHaveLength(0);
  });

  it("passes correct pagination params to prisma", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" } as any);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const req = new Request("http://localhost/api/documents/doc-1/activity?page=3");
    await GET(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { documentId: "doc-1" },
      orderBy: { createdAt: "desc" },
      skip: 40, // (3-1) * 20
      take: 20,
    });
  });
});

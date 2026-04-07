import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../route";

const mockGetSession = vi.mocked(getServerSession);
const mockFindMany = vi.mocked(prisma.notification.findMany);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/notifications");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString()) as any;
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns notifications for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);

    const notifications = [
      {
        id: "notif-1",
        userId: "user-1",
        type: "comment",
        documentId: "doc-1",
        documentTitle: "Test Doc",
        actorName: "Alice",
        actorId: "actor-1",
        message: "Alice commented on Test Doc",
        read: false,
        createdAt: new Date("2026-04-06T10:00:00Z"),
      },
    ];
    mockFindMany.mockResolvedValue(notifications as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("notif-1");
    expect(data[0].type).toBe("comment");
  });

  it("filters unread only when unread=true", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest({ unread: "true" }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", read: false }),
      })
    );
  });

  it("respects limit parameter capped at 50", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest({ limit: "100" }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("uses cursor for pagination", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    const cursor = "2026-04-06T10:00:00Z";
    await GET(makeRequest({ cursor }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(cursor) },
        }),
      })
    );
  });

  it("defaults to limit of 20", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });
});

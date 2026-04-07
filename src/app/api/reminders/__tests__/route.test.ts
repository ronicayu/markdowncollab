import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reminder: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockFindMany = vi.mocked(prisma.reminder.findMany);
const mockCreate = vi.mocked(prisma.reminder.create);
const mockFindFirst = vi.mocked(prisma.reminder.findFirst);
const mockUpdate = vi.mocked(prisma.reminder.update);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("GET /api/reminders", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { GET } = await import("../route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns active reminders for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const mockReminders = [
      {
        id: "r1",
        documentId: "doc-1",
        userId: "user-1",
        remindAt: new Date("2026-04-10T10:00:00Z"),
        message: "Review draft",
        dismissed: false,
        createdAt: new Date(),
      },
    ];
    mockFindMany.mockResolvedValue(mockReminders as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("r1");
    expect(data[0].message).toBe("Review draft");
  });
});

describe("POST /api/reminders", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-1",
        remindAt: "2026-04-10T10:00:00Z",
      }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when documentId is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remindAt: "2026-04-10T10:00:00Z" }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when remindAt is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: "doc-1" }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates a reminder successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const created = {
      id: "r-new",
      documentId: "doc-1",
      userId: "user-1",
      remindAt: new Date("2026-04-10T10:00:00Z"),
      message: "Check doc",
      dismissed: false,
      createdAt: new Date(),
    };
    mockCreate.mockResolvedValue(created as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-1",
        remindAt: "2026-04-10T10:00:00Z",
        message: "Check doc",
      }),
    }) as any;
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("r-new");
  });

  it("returns 400 for invalid date", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const { POST } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: "doc-1",
        remindAt: "not-a-date",
      }),
    }) as any;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/reminders", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/reminders?id=r1", {
      method: "DELETE",
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/reminders", {
      method: "DELETE",
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when reminder not found", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);
    mockFindFirst.mockResolvedValue(null);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/reminders?id=nonexistent", {
      method: "DELETE",
    }) as any;
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("dismisses a reminder successfully", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "",
    } as any);
    mockFindFirst.mockResolvedValue({
      id: "r1",
      userId: "user-1",
    } as any);
    mockUpdate.mockResolvedValue({} as any);

    const { DELETE } = await import("../route");
    const req = new Request("http://localhost/api/reminders?id=r1", {
      method: "DELETE",
    }) as any;
    const res = await DELETE(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { dismissed: true },
    });
  });
});

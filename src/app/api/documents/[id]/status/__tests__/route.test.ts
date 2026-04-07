import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn(), update: vi.fn() },
    activityLog: { create: vi.fn() },
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
const mockDocUpdate = vi.mocked(prisma.document.update);
const mockActivityCreate = vi.mocked(prisma.activityLog.create);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("GET /api/documents/[id]/status", () => {
  it("returns document status", async () => {
    mockDocFindUnique.mockResolvedValue({
      status: "draft",
      approvedBy: null,
      approvedAt: null,
    } as any);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status");
    const res = await GET(req, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("draft");
  });

  it("returns 404 for missing document", async () => {
    mockDocFindUnique.mockResolvedValue(null);

    const { GET } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status");
    const res = await GET(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/documents/[id]/status", () => {
  it("requires authentication", async () => {
    mockGetSession.mockResolvedValue(null);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_review" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(401);
  });

  it("requires owner role", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-2", name: "Other", email: "other@test.com" },
      expires: "never",
    } as any);

    mockDocFindUnique.mockResolvedValue({
      id: "doc-1",
      ownerId: "user-1",
      status: "draft",
    } as any);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_review" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(403);
  });

  it("validates status transitions: draft -> in_review", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "never",
    } as any);

    mockDocFindUnique.mockResolvedValue({
      id: "doc-1",
      ownerId: "user-1",
      status: "draft",
    } as any);

    mockDocUpdate.mockResolvedValue({
      id: "doc-1",
      status: "in_review",
      approvedBy: null,
      approvedAt: null,
    } as any);

    mockActivityCreate.mockResolvedValue({} as any);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in_review" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("in_review");
  });

  it("rejects invalid transition: draft -> approved", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "never",
    } as any);

    mockDocFindUnique.mockResolvedValue({
      id: "doc-1",
      ownerId: "user-1",
      status: "draft",
    } as any);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(400);
  });

  it("sets approvedBy and approvedAt when approving", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Approver", email: "test@test.com" },
      expires: "never",
    } as any);

    mockDocFindUnique.mockResolvedValue({
      id: "doc-1",
      ownerId: "user-1",
      status: "in_review",
    } as any);

    mockDocUpdate.mockResolvedValue({
      id: "doc-1",
      status: "approved",
      approvedBy: "Approver",
      approvedAt: new Date(),
    } as any);

    mockActivityCreate.mockResolvedValue({} as any);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("approved");
    expect(data.approvedBy).toBe("Approver");
    expect(data.approvedAt).toBeTruthy();

    // Verify the update was called with approvedBy
    expect(mockDocUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "approved",
          approvedBy: "Approver",
        }),
      })
    );
  });

  it("rejects invalid status values", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
      expires: "never",
    } as any);

    mockDocFindUnique.mockResolvedValue({
      id: "doc-1",
      ownerId: "user-1",
      status: "draft",
    } as any);

    const { PUT } = await import("../route");
    const req = new Request("http://localhost/api/documents/doc-1/status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "invalid" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(400);
  });
});

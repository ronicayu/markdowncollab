import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    folder: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    document: {
      updateMany: vi.fn(),
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
const mockFolderFindMany = vi.mocked(prisma.folder.findMany);
const mockFolderFindFirst = vi.mocked(prisma.folder.findFirst);
const mockFolderCreate = vi.mocked(prisma.folder.create);
const mockFolderUpdate = vi.mocked(prisma.folder.update);
const mockFolderUpdateMany = vi.mocked(prisma.folder.updateMany);
const mockFolderDelete = vi.mocked(prisma.folder.delete);
const mockDocUpdateMany = vi.mocked(prisma.document.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/folders", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/folders");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns folder tree for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFolderFindMany.mockResolvedValue([
      { id: "f1", name: "Work", parentId: null, ownerId: "user-1", createdAt: new Date() },
      { id: "f2", name: "Drafts", parentId: "f1", ownerId: "user-1", createdAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/folders");
    const res = await GET(req);
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Work");
    expect(data[0].children).toHaveLength(1);
    expect(data[0].children[0].name).toBe("Drafts");
  });
});

describe("POST /api/folders", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("creates a folder", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    const created = { id: "f3", name: "Projects", parentId: null, ownerId: "user-1", createdAt: new Date() };
    mockFolderCreate.mockResolvedValue(created as any);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "Projects" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Projects");
  });

  it("returns 400 for empty name", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/folders", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/folders/[id]", () => {
  it("renames a folder", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFolderFindFirst.mockResolvedValue({ id: "f1", name: "Old", parentId: null, ownerId: "user-1", createdAt: new Date() } as any);
    mockFolderUpdate.mockResolvedValue({ id: "f1", name: "Renamed", parentId: null, ownerId: "user-1", createdAt: new Date() } as any);

    const { PUT } = await import("../[id]/route");
    const req = new Request("http://localhost/api/folders/f1", {
      method: "PUT",
      body: JSON.stringify({ name: "Renamed" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "f1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Renamed");
  });

  it("returns 404 for non-existent folder", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFolderFindFirst.mockResolvedValue(null);

    const { PUT } = await import("../[id]/route");
    const req = new Request("http://localhost/api/folders/nonexistent", {
      method: "PUT",
      body: JSON.stringify({ name: "Test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/folders/[id]", () => {
  it("deletes a folder and moves docs to parent", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFolderFindFirst.mockResolvedValue({ id: "f1", name: "Work", parentId: null, ownerId: "user-1", createdAt: new Date() } as any);
    mockDocUpdateMany.mockResolvedValue({ count: 2 } as any);
    mockFolderUpdateMany.mockResolvedValue({ count: 0 } as any);
    mockFolderDelete.mockResolvedValue({} as any);

    const { DELETE } = await import("../[id]/route");
    const req = new Request("http://localhost/api/folders/f1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "f1" }) });
    expect(res.status).toBe(200);

    expect(mockDocUpdateMany).toHaveBeenCalledWith({
      where: { folderId: "f1" },
      data: { folderId: null },
    });
  });
});

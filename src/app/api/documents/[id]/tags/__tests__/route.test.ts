import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentTag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockDocTagFindMany = vi.mocked(prisma.documentTag.findMany);
const mockDocTagFindFirst = vi.mocked(prisma.documentTag.findFirst);
const mockDocTagCreate = vi.mocked(prisma.documentTag.create);
const mockDocTagDeleteMany = vi.mocked(prisma.documentTag.deleteMany);
const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockTagFindUnique = vi.mocked(prisma.tag.findUnique);

const makeParams = (id: string) => Promise.resolve({ id });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents/[id]/tags", () => {
  it("returns tags for a document", async () => {
    mockDocTagFindMany.mockResolvedValue([
      { id: "dt1", documentId: "doc-1", tagId: "t1" },
      { id: "dt2", documentId: "doc-1", tagId: "t2" },
    ] as any);
    mockTagFindMany.mockResolvedValue([
      { id: "t1", name: "Bug", color: "#ef4444" },
      { id: "t2", name: "Feature", color: "#3b82f6" },
    ] as any);

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags");
    const res = await GET(req, { params: makeParams("doc-1") });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe("Bug");
  });

  it("returns empty array when document has no tags", async () => {
    mockDocTagFindMany.mockResolvedValue([]);

    const { GET } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags");
    const res = await GET(req, { params: makeParams("doc-1") });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(0);
  });
});

describe("POST /api/documents/[id]/tags", () => {
  it("adds a tag to a document", async () => {
    mockDocTagFindFirst.mockResolvedValue(null);
    mockDocTagCreate.mockResolvedValue({
      id: "dt-new",
      documentId: "doc-1",
      tagId: "t1",
    } as any);
    mockTagFindUnique.mockResolvedValue({
      id: "t1",
      name: "Bug",
      color: "#ef4444",
    } as any);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: "t1" }),
    });
    const res = await POST(req, { params: makeParams("doc-1") });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Bug");
  });

  it("returns existing tag if already linked", async () => {
    mockDocTagFindFirst.mockResolvedValue({
      id: "dt-existing",
      documentId: "doc-1",
      tagId: "t1",
    } as any);
    mockTagFindUnique.mockResolvedValue({
      id: "t1",
      name: "Bug",
      color: "#ef4444",
    } as any);

    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: "t1" }),
    });
    const res = await POST(req, { params: makeParams("doc-1") });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Bug");
    expect(mockDocTagCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when tagId is missing", async () => {
    const { POST } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: makeParams("doc-1") });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/documents/[id]/tags", () => {
  it("removes a tag from a document", async () => {
    mockDocTagDeleteMany.mockResolvedValue({ count: 1 } as any);

    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: "t1" }),
    });
    const res = await DELETE(req, { params: makeParams("doc-1") });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockDocTagDeleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc-1", tagId: "t1" },
    });
  });

  it("returns 400 when tagId is missing", async () => {
    const { DELETE } = await import("../route");
    const req = new NextRequest("http://localhost/api/documents/doc-1/tags", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await DELETE(req, { params: makeParams("doc-1") });

    expect(res.status).toBe(400);
  });
});

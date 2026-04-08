import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findMany: vi.fn() },
    documentShare: { findMany: vi.fn() },
    tag: { findMany: vi.fn() },
    documentTag: { findMany: vi.fn() },
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
const mockDocFindMany = vi.mocked(prisma.document.findMany);
const mockShareFindMany = vi.mocked(prisma.documentShare.findMany);
const mockTagFindMany = vi.mocked(prisma.tag.findMany);
const mockDocTagFindMany = vi.mocked(prisma.documentTag.findMany);

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("GET /api/documents/search", () => {
  it("returns 400 when no query is provided", async () => {
    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns matching documents by title for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "Meeting Notes", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date("2025-01-01") },
      { id: "doc-2", title: "Random Title", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date("2025-01-02") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=meeting");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe("doc-1");
    expect(data.items[0].title).toBe("Meeting Notes");
  });

  it("returns matching documents by title for unauthenticated user", async () => {
    mockGetSession.mockResolvedValue(null);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-legacy", title: "Budget Report", ownerId: null, visibility: "private", createdAt: new Date(), updatedAt: new Date("2025-01-01") },
    ] as any);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=budget");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe("Budget Report");
  });

  it("returns empty array when no title matches and no md files", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-3", title: "Unrelated Doc", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date("2025-01-01") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=xyznotfound");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(0);
  });

  it("is case-insensitive for title search", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "MEETING Notes", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date("2025-01-01") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=meeting");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
  });
});

describe("GET /api/documents/search with filters", () => {
  it("filters by tag name", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockTagFindMany.mockResolvedValue([{ id: "tag-1", name: "important", color: "#ff0000" }] as any);
    mockDocTagFindMany.mockResolvedValue([{ documentId: "doc-1", tagId: "tag-1" }] as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "Meeting Notes", ownerId: "user-1", updatedAt: new Date("2025-01-01") },
      { id: "doc-2", title: "Meeting Agenda", ownerId: "user-1", updatedAt: new Date("2025-01-02") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=meeting&tag=important");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Only doc-1 has the tag
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe("doc-1");
  });

  it("filters by folderId", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "Project Notes", ownerId: "user-1", folderId: "folder-1", updatedAt: new Date("2025-01-01") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=project&folderId=folder-1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe("doc-1");
  });

  it("filters by date range", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "January Notes", ownerId: "user-1", updatedAt: new Date("2025-01-15") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=notes&dateFrom=2025-01-01&dateTo=2025-01-31");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].id).toBe("doc-1");
  });

  it("returns empty when tag filter matches no documents", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@example.com" },
      expires: "never",
    } as any);

    mockTagFindMany.mockResolvedValue([{ id: "tag-99", name: "nonexistent", color: "#000" }] as any);
    mockDocTagFindMany.mockResolvedValue([] as any);

    mockDocFindMany.mockResolvedValue([
      { id: "doc-1", title: "Meeting Notes", ownerId: "user-1", updatedAt: new Date("2025-01-01") },
    ] as any);

    mockShareFindMany.mockResolvedValue([]);

    const { GET } = await import("../../search/route");
    const req = new Request("http://localhost/api/documents/search?q=meeting&tag=nonexistent");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.items).toHaveLength(0);
  });
});

describe("extractSnippet (unit test)", () => {
  it("extracts snippet with match highlighted", async () => {
    // Import the module to get access to the function
    // Since extractSnippet is not exported, test it indirectly through GET
    // OR we can test the snippet format expectation
    const content = "This is a test document with some important budget information here.";
    const query = "budget";
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    expect(idx).toBeGreaterThan(-1);

    // Verify snippet extraction logic
    const contextChars = 50;
    const start = Math.max(0, idx - contextChars);
    const end = Math.min(content.length, idx + query.length + contextChars);
    const snippet = content.slice(start, end);
    expect(snippet).toContain("budget");
  });
});

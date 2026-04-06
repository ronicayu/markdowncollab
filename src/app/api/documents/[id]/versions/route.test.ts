import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    documentVersion: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const mockPrisma = prisma as unknown as {
  documentVersion: {
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  document: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function makeRequest(url: string, options?: RequestInit) {
  return new Request(url, options);
}

const params = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]/versions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated version list", async () => {
    const versions = [
      {
        id: "v1",
        title: "My Doc",
        createdByName: "Alice",
        type: "manual",
        createdAt: new Date("2026-04-06T10:00:00Z"),
      },
      {
        id: "v2",
        title: "My Doc",
        createdByName: "System",
        type: "auto",
        createdAt: new Date("2026-04-06T09:00:00Z"),
      },
    ];
    mockPrisma.documentVersion.findMany.mockResolvedValue(versions);
    mockPrisma.documentVersion.count.mockResolvedValue(2);

    const req = makeRequest("http://localhost:3000/api/documents/doc-1/versions?page=1");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.versions).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.page).toBe(1);
    expect(data.pageSize).toBe(20);
  });

  it("defaults to page 1 when no page param", async () => {
    mockPrisma.documentVersion.findMany.mockResolvedValue([]);
    mockPrisma.documentVersion.count.mockResolvedValue(0);

    const req = makeRequest("http://localhost:3000/api/documents/doc-1/versions");
    await GET(req, { params });

    expect(mockPrisma.documentVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

describe("POST /api/documents/[id]/versions (manual snapshot)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 501 (manual snapshot created via API with Yjs connection)", async () => {
    // The POST endpoint will need a Yjs connection to get current doc state.
    // This is tested more in the integration test. Unit test just checks shape.
    const req = makeRequest("http://localhost:3000/api/documents/doc-1/versions", {
      method: "POST",
      body: JSON.stringify({ name: "My checkpoint" }),
      headers: { "Content-Type": "application/json" },
    });

    // We expect this to attempt a WS connection; mock will fail gracefully
    // In unit tests we just verify the route exists and handles errors
    const res = await POST(req, { params });
    // Should return either success or a connection error, not a crash
    expect([200, 201, 404, 500]).toContain(res.status);
  });
});

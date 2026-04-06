import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    documentVersion: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);

const mockPrisma = prisma as unknown as {
  documentVersion: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const params = Promise.resolve({ id: "doc-1", versionId: "ver-1" });

describe("GET /api/documents/[id]/versions/[versionId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "viewer" });
  });

  it("returns 404 when version not found", async () => {
    mockPrisma.documentVersion.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/documents/doc-1/versions/ver-1");
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it("returns markdown preview from stored snapshot", async () => {
    // Create a real Yjs snapshot to store
    const doc = new Y.Doc();
    const yxml = doc.getXmlFragment("default");
    const heading = new Y.XmlElement("heading");
    heading.setAttribute("level", 1);
    heading.insert(0, [new Y.XmlText("Hello")]);
    yxml.insert(0, [heading]);

    const state = Y.encodeStateAsUpdate(doc);
    const snapshot = Buffer.from(state);

    mockPrisma.documentVersion.findUnique.mockResolvedValue({
      id: "ver-1",
      documentId: "doc-1",
      snapshot,
      title: "Test Doc",
      createdByName: "Alice",
      type: "manual",
      createdAt: new Date("2026-04-06T10:00:00Z"),
    });

    const req = new Request("http://localhost:3000/api/documents/doc-1/versions/ver-1");
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.markdown).toContain("# Hello");
    expect(data.id).toBe("ver-1");
    expect(data.title).toBe("Test Doc");
  });
});

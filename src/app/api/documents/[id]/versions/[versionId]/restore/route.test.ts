import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    documentVersion: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    document: {
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

vi.mock("@/lib/yjs-server-connect", () => ({
  connectYjsServer: vi.fn(),
}));

vi.mock("@/lib/version-snapshot", () => ({
  createSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot, restoreSnapshot } from "@/lib/version-snapshot";
import { POST } from "./route";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);

const mockPrisma = prisma as unknown as {
  documentVersion: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  document: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const params = Promise.resolve({ id: "doc-1", versionId: "ver-1" });

describe("POST /api/documents/[id]/versions/[versionId]/restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "editor" });
  });

  it("returns 404 when version not found", async () => {
    mockPrisma.documentVersion.findUnique.mockResolvedValue(null);

    const req = new Request(
      "http://localhost:3000/api/documents/doc-1/versions/ver-1/restore",
      { method: "POST" }
    );
    const res = await POST(req, { params });
    expect(res.status).toBe(404);
  });

  it("creates a 'before restore' snapshot before restoring", async () => {
    const doc = new Y.Doc();
    const state = Y.encodeStateAsUpdate(doc);

    mockPrisma.documentVersion.findUnique.mockResolvedValue({
      id: "ver-1",
      documentId: "doc-1",
      snapshot: Buffer.from(state),
      title: "Old version",
      createdAt: new Date("2026-04-06T09:00:00Z"),
    });
    mockPrisma.document.findUnique.mockResolvedValue({ title: "Current title" });

    const mockCleanup = vi.fn();
    const mockYdoc = new Y.Doc();
    (connectYjsServer as ReturnType<typeof vi.fn>).mockResolvedValue({
      ydoc: mockYdoc,
      awareness: {},
      cleanup: mockCleanup,
    });
    (createSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "restore-snap",
    });

    const req = new Request(
      "http://localhost:3000/api/documents/doc-1/versions/ver-1/restore",
      { method: "POST" }
    );
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    // Should create a "before restore" snapshot first
    expect(createSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "restore",
        title: expect.stringContaining("Before restore to"),
      })
    );
    // Should call restoreSnapshot
    expect(restoreSnapshot).toHaveBeenCalled();
    // Should clean up the WS connection
    expect(mockCleanup).toHaveBeenCalled();
  });
});

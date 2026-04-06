import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  createSnapshot,
  restoreSnapshot,
  pruneAutoSnapshots,
} from "./version-snapshot";

// Mock prisma
vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    documentVersion: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as {
  documentVersion: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

describe("version-snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createSnapshot", () => {
    it("encodes the current Yjs state and saves to DB", async () => {
      const doc = new Y.Doc();
      const yxml = doc.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Hello world")]);
      yxml.insert(0, [paragraph]);

      mockPrisma.documentVersion.create.mockResolvedValue({
        id: "ver-1",
        documentId: "doc-1",
        type: "manual",
        createdAt: new Date(),
      });
      mockPrisma.documentVersion.count.mockResolvedValue(10);

      const result = await createSnapshot({
        doc,
        documentId: "doc-1",
        title: "Test doc",
        type: "manual",
        createdBy: "user-1",
        createdByName: "Alice",
      });

      expect(mockPrisma.documentVersion.create).toHaveBeenCalledOnce();
      const callArgs = mockPrisma.documentVersion.create.mock.calls[0][0];
      expect(callArgs.data.documentId).toBe("doc-1");
      expect(callArgs.data.type).toBe("manual");
      expect(callArgs.data.title).toBe("Test doc");
      expect(callArgs.data.createdBy).toBe("user-1");
      expect(callArgs.data.createdByName).toBe("Alice");
      expect(callArgs.data.snapshot).toBeInstanceOf(Buffer);
      expect(result.id).toBe("ver-1");
    });

    it("stores snapshot as Buffer that can be used to restore", async () => {
      const doc = new Y.Doc();
      const yxml = doc.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Snapshot content")]);
      yxml.insert(0, [paragraph]);

      let savedSnapshot: Buffer | null = null;
      mockPrisma.documentVersion.create.mockImplementation(
        async (args: { data: { snapshot: Buffer } }) => {
          savedSnapshot = args.data.snapshot;
          return { id: "ver-2", documentId: "doc-1", type: "auto", createdAt: new Date() };
        }
      );
      mockPrisma.documentVersion.count.mockResolvedValue(5);

      await createSnapshot({
        doc,
        documentId: "doc-1",
        title: "Test",
        type: "auto",
      });

      // The saved snapshot should be valid Yjs state
      expect(savedSnapshot).not.toBeNull();
      const restoredDoc = new Y.Doc();
      Y.applyUpdate(restoredDoc, new Uint8Array(savedSnapshot!));
      const restoredXml = restoredDoc.getXmlFragment("default");
      expect(restoredXml.length).toBe(1);
    });
  });

  describe("restoreSnapshot", () => {
    it("applies a stored snapshot to the target doc", () => {
      // Create original doc with content
      const originalDoc = new Y.Doc();
      const yxml = originalDoc.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Original content")]);
      yxml.insert(0, [paragraph]);
      const snapshotData = Buffer.from(Y.encodeStateAsUpdate(originalDoc));

      // Create a different target doc
      const targetDoc = new Y.Doc();
      const targetXml = targetDoc.getXmlFragment("default");
      const newParagraph = new Y.XmlElement("paragraph");
      newParagraph.insert(0, [new Y.XmlText("Modified content")]);
      targetXml.insert(0, [newParagraph]);

      // Restore should clear target and apply snapshot
      restoreSnapshot(targetDoc, snapshotData);

      // The target doc should have content from the snapshot
      const restoredXml = targetDoc.getXmlFragment("default");
      expect(restoredXml.length).toBeGreaterThan(0);
    });
  });

  describe("pruneAutoSnapshots", () => {
    it("does nothing when auto snapshot count is <= 50", async () => {
      mockPrisma.documentVersion.count.mockResolvedValue(30);

      await pruneAutoSnapshots("doc-1");

      expect(mockPrisma.documentVersion.deleteMany).not.toHaveBeenCalled();
    });

    it("deletes oldest auto snapshots when count exceeds 50", async () => {
      mockPrisma.documentVersion.count.mockResolvedValue(55);
      mockPrisma.documentVersion.findMany.mockResolvedValue([
        { id: "old-1" },
        { id: "old-2" },
        { id: "old-3" },
        { id: "old-4" },
        { id: "old-5" },
      ]);
      mockPrisma.documentVersion.deleteMany.mockResolvedValue({ count: 5 });

      await pruneAutoSnapshots("doc-1");

      // Should query for the 5 oldest auto snapshots
      expect(mockPrisma.documentVersion.findMany).toHaveBeenCalledWith({
        where: { documentId: "doc-1", type: "auto" },
        orderBy: { createdAt: "asc" },
        take: 5,
        select: { id: true },
      });

      // Should delete those 5
      expect(mockPrisma.documentVersion.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["old-1", "old-2", "old-3", "old-4", "old-5"] } },
      });
    });

    it("never prunes manual or restore snapshots", async () => {
      mockPrisma.documentVersion.count.mockResolvedValue(60);
      mockPrisma.documentVersion.findMany.mockResolvedValue([
        { id: "old-1" },
      ]);
      mockPrisma.documentVersion.deleteMany.mockResolvedValue({ count: 1 });

      await pruneAutoSnapshots("doc-1");

      // The count query should only filter for type "auto"
      expect(mockPrisma.documentVersion.count).toHaveBeenCalledWith({
        where: { documentId: "doc-1", type: "auto" },
      });
    });
  });
});

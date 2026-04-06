import * as Y from "yjs";
import { prisma } from "@/lib/prisma";

const MAX_AUTO_SNAPSHOTS = 50;

interface CreateSnapshotParams {
  doc: Y.Doc;
  documentId: string;
  title: string;
  type: "auto" | "manual" | "restore";
  createdBy?: string;
  createdByName?: string;
}

/**
 * Create a snapshot of the current Yjs document state and persist it.
 * Returns the created DocumentVersion record.
 */
export async function createSnapshot({
  doc,
  documentId,
  title,
  type,
  createdBy,
  createdByName,
}: CreateSnapshotParams) {
  const state = Y.encodeStateAsUpdate(doc);
  const snapshot = Buffer.from(state);

  const version = await prisma.documentVersion.create({
    data: {
      documentId,
      snapshot,
      title,
      type,
      createdBy: createdBy ?? null,
      createdByName: createdByName ?? null,
    },
  });

  // Prune old auto snapshots in the background
  if (type === "auto") {
    pruneAutoSnapshots(documentId).catch((err) =>
      console.error("Failed to prune auto snapshots:", err)
    );
  }

  return version;
}

/**
 * Restore a Yjs document from a stored snapshot buffer.
 * Clears the target doc's XML fragment and applies the snapshot state.
 */
export function restoreSnapshot(targetDoc: Y.Doc, snapshotData: Buffer) {
  // Clear existing content by deleting all elements from the XML fragment
  const yxml = targetDoc.getXmlFragment("default");
  targetDoc.transact(() => {
    while (yxml.length > 0) {
      yxml.delete(0, 1);
    }
  });

  // Apply the snapshot state
  Y.applyUpdate(targetDoc, new Uint8Array(snapshotData));
}

/**
 * Delete the oldest auto snapshots for a document when count exceeds MAX_AUTO_SNAPSHOTS.
 * Manual and restore snapshots are never pruned.
 */
export async function pruneAutoSnapshots(documentId: string) {
  const count = await prisma.documentVersion.count({
    where: { documentId, type: "auto" },
  });

  if (count <= MAX_AUTO_SNAPSHOTS) return;

  const excess = count - MAX_AUTO_SNAPSHOTS;
  const oldest = await prisma.documentVersion.findMany({
    where: { documentId, type: "auto" },
    orderBy: { createdAt: "asc" },
    take: excess,
    select: { id: true },
  });

  if (oldest.length > 0) {
    await prisma.documentVersion.deleteMany({
      where: { id: { in: oldest.map((v) => v.id) } },
    });
  }
}

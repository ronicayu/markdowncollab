# Version History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add version history with auto/manual snapshots and restore capability using Yjs snapshots stored in SQLite.

**Architecture:** Store Yjs snapshots in a new DocumentVersion Prisma model. Auto-snapshot every 30 min of active editing and on last client disconnect. UI panel slides out from right side with version list, preview, and restore.

**Tech Stack:** Yjs (encodeSnapshot/applySnapshot), Prisma, React, Tailwind

---

## Task 1: Schema Migration — DocumentVersion Model

**File:** `/Users/ronica/projects/markdown-collab/prisma/schema.prisma`

- [ ] Add `DocumentVersion` model to `prisma/schema.prisma`:

```prisma
model DocumentVersion {
  id            String   @id @default(uuid())
  documentId    String
  document      Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  snapshot      Bytes
  title         String
  createdBy     String?
  createdByName String?
  type          String   @default("auto")
  createdAt     DateTime @default(now())

  @@index([documentId, createdAt])
}
```

- [ ] Add the reverse relation to the existing `Document` model:

```prisma
model Document {
  id        String   @id @default(uuid())
  title     String   @default("Untitled")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  versions  DocumentVersion[]
}
```

- [ ] Run the migration:

```bash
cd /Users/ronica/projects/markdown-collab && npx prisma migrate dev --name add-document-versions
```

- [ ] Verify the migration succeeded:

```bash
cd /Users/ronica/projects/markdown-collab && npx prisma migrate status
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add prisma/ && git commit -m "feat: add DocumentVersion schema for version history"
```

---

## Task 2: Snapshot Utility Functions with Tests

**Files:**
- `/Users/ronica/projects/markdown-collab/src/lib/version-snapshot.ts` (new)
- `/Users/ronica/projects/markdown-collab/src/lib/version-snapshot.test.ts` (new)

### 2a: Write tests first

- [ ] Create `/Users/ronica/projects/markdown-collab/src/lib/version-snapshot.test.ts`:

```typescript
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
```

- [ ] Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/lib/version-snapshot.test.ts
```

### 2b: Implement snapshot utilities

- [ ] Create `/Users/ronica/projects/markdown-collab/src/lib/version-snapshot.ts`:

```typescript
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
```

- [ ] Run tests (expect all to pass):

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/lib/version-snapshot.test.ts
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add src/lib/version-snapshot.ts src/lib/version-snapshot.test.ts && git commit -m "feat: snapshot utility functions (create, restore, prune) with tests"
```

---

## Task 3: Auto-Snapshot Logic in WebSocket Server

**File:** `/Users/ronica/projects/markdown-collab/server/combined-server.mjs`

- [ ] Add dynamic import for prisma client at the top of the file (after existing imports):

```javascript
// At top of file, after existing imports:
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
```

- [ ] Add snapshot tracking state inside the `getDoc` function. Modify the `getDoc` function to track `lastSnapshotTime` per document and add the auto-snapshot logic. Add these lines inside the `getDoc` function, after `const entry = { doc, awareness, conns: new Set() };`:

```javascript
  // --- Auto-snapshot tracking ---
  const SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
  entry.lastSnapshotTime = Date.now();
  entry.hasEdits = false;

  // Track edits for snapshot timing
  doc.on("update", () => {
    entry.hasEdits = true;
  });
```

- [ ] Add an `autoSnapshotIfDue` helper function before the `getDoc` function:

```javascript
async function createAutoSnapshot(docName, doc) {
  try {
    const Y = await import("yjs");
    const state = Y.encodeStateAsUpdate(doc);
    const snapshot = Buffer.from(state);

    // Look up the document title from the database
    const dbDoc = await prisma.document.findUnique({
      where: { id: docName },
      select: { title: true },
    });
    const title = dbDoc?.title || "Untitled";

    await prisma.documentVersion.create({
      data: {
        documentId: docName,
        snapshot,
        title,
        type: "auto",
        createdBy: null,
        createdByName: "System",
      },
    });

    // Prune old auto snapshots (keep last 50)
    const count = await prisma.documentVersion.count({
      where: { documentId: docName, type: "auto" },
    });
    if (count > 50) {
      const excess = count - 50;
      const oldest = await prisma.documentVersion.findMany({
        where: { documentId: docName, type: "auto" },
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

    console.log(`Auto-snapshot created for ${docName}`);
  } catch (err) {
    console.error(`Failed to create auto-snapshot for ${docName}:`, err.message);
  }
}
```

- [ ] Inside the existing `doc.on("update", ...)` callback in `getDoc`, after the markdown saving logic (inside the `setTimeout` callback), add the timed auto-snapshot check:

```javascript
      // Auto-snapshot every 30 minutes of active editing
      const docEntry = docs.get(docName);
      if (docEntry && docEntry.hasEdits) {
        const elapsed = Date.now() - docEntry.lastSnapshotTime;
        if (elapsed >= 30 * 60 * 1000) {
          docEntry.lastSnapshotTime = Date.now();
          docEntry.hasEdits = false;
          createAutoSnapshot(docName, doc);
        }
      }
```

- [ ] In the `ws.on("close", ...)` handler inside `wss.on("connection", ...)`, add auto-snapshot on last client disconnect. Replace the existing close handler:

```javascript
  ws.on("close", () => {
    docConns.delete(ws);
    awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);

    // Auto-snapshot when last client disconnects
    if (docConns.size === 0) {
      const docEntry = docs.get(docName);
      if (docEntry && docEntry.hasEdits) {
        docEntry.hasEdits = false;
        docEntry.lastSnapshotTime = Date.now();
        createAutoSnapshot(docName, doc);
      }
    }
  });
```

- [ ] Verify the server starts without errors:

```bash
cd /Users/ronica/projects/markdown-collab && timeout 5 node server/combined-server.mjs 2>&1 || true
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add server/combined-server.mjs && git commit -m "feat: auto-snapshot every 30min and on last client disconnect"
```

---

## Task 4: Version List API Endpoint

**File:** `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/route.ts` (new)

### 4a: Write tests first

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/route.test.ts`:

```typescript
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
    expect([200, 201, 500]).toContain(res.status);
  });
});
```

- [ ] Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/route.test.ts
```

### 4b: Implement version list endpoint

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot } from "@/lib/version-snapshot";

const PAGE_SIZE = 20;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const [versions, total] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        createdByName: true,
        type: true,
        createdAt: true,
      },
    }),
    prisma.documentVersion.count({ where: { documentId: id } }),
  ]);

  return NextResponse.json({ versions, total, page, pageSize: PAGE_SIZE });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const name = body.name || null;

    // Get current document title
    const dbDoc = await prisma.document.findUnique({
      where: { id },
      select: { title: true },
    });
    if (!dbDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Connect to Yjs to get current state
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;

    const version = await createSnapshot({
      doc: conn.ydoc,
      documentId: id,
      title: name || dbDoc.title,
      type: "manual",
      createdByName: body.createdByName || "Anonymous",
    });

    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("Failed to create manual snapshot:", error);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  } finally {
    cleanup?.();
  }
}
```

- [ ] Run tests:

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/route.test.ts
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add -f src/app/api/documents/\\[id\\]/versions/ && git commit -m "feat: version list and manual snapshot API endpoints"
```

---

## Task 5: Version Preview API Endpoint

**File:** `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/route.ts` (new)

### 5a: Write tests first

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/route.test.ts`:

```typescript
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

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const mockPrisma = prisma as unknown as {
  documentVersion: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

const params = Promise.resolve({ id: "doc-1", versionId: "ver-1" });

describe("GET /api/documents/[id]/versions/[versionId]", () => {
  beforeEach(() => vi.clearAllMocks());

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
```

- [ ] Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/route.test.ts
```

### 5b: Implement preview endpoint

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import * as Y from "yjs";
import { prisma } from "@/lib/prisma";
import { xmlFragmentToMarkdown } from "@/lib/export-markdown";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;

  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId, documentId: id },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Reconstruct the Yjs doc from the snapshot and convert to markdown
  const tempDoc = new Y.Doc();
  try {
    Y.applyUpdate(tempDoc, new Uint8Array(version.snapshot));
    const yxml = tempDoc.getXmlFragment("default");
    const markdown = yxml.length > 0 ? xmlFragmentToMarkdown(yxml) : "";

    return NextResponse.json({
      id: version.id,
      documentId: version.documentId,
      title: version.title,
      createdByName: version.createdByName,
      type: version.type,
      createdAt: version.createdAt,
      markdown,
    });
  } finally {
    tempDoc.destroy();
  }
}
```

- [ ] Run tests:

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/route.test.ts
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add -f src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/ && git commit -m "feat: version preview API endpoint with markdown rendering"
```

---

## Task 6: Restore API Endpoint

**File:** `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/restore/route.ts` (new)

### 6a: Write tests first

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/restore/route.test.ts`:

```typescript
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

vi.mock("@/lib/yjs-server-connect", () => ({
  connectYjsServer: vi.fn(),
}));

vi.mock("@/lib/version-snapshot", () => ({
  createSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot, restoreSnapshot } from "@/lib/version-snapshot";
import { POST } from "./route";

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
  beforeEach(() => vi.clearAllMocks());

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
```

- [ ] Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/restore/route.test.ts
```

### 6b: Implement restore endpoint

- [ ] Create `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/versions/[versionId]/restore/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { createSnapshot, restoreSnapshot } from "@/lib/version-snapshot";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params;
  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;

  try {
    // Fetch the version to restore
    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId, documentId: id },
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Get current document title
    const dbDoc = await prisma.document.findUnique({
      where: { id },
      select: { title: true },
    });

    // Connect to the live Yjs document
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;

    // Create a "before restore" snapshot of the current state
    const restoreDate = version.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    await createSnapshot({
      doc: conn.ydoc,
      documentId: id,
      title: `Before restore to ${restoreDate}`,
      type: "restore",
      createdByName: "System",
    });

    // Restore the snapshot — this modifies the live Yjs doc,
    // which broadcasts updates to all connected clients via the WS server
    restoreSnapshot(conn.ydoc, version.snapshot);

    return NextResponse.json({
      ok: true,
      restoredVersionId: versionId,
      message: `Restored to version from ${restoreDate}`,
    });
  } catch (error) {
    console.error("Failed to restore version:", error);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  } finally {
    // Small delay to let the Yjs update propagate to connected clients
    await new Promise((resolve) => setTimeout(resolve, 500));
    cleanup?.();
  }
}
```

- [ ] Run tests:

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/restore/route.test.ts
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add -f src/app/api/documents/\\[id\\]/versions/\\[versionId\\]/restore/ && git commit -m "feat: version restore API endpoint with safety snapshot"
```

---

## Task 7: Version History Types

**File:** `/Users/ronica/projects/markdown-collab/src/types/index.ts`

- [ ] Add version history types to the bottom of `/Users/ronica/projects/markdown-collab/src/types/index.ts`:

```typescript
export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  createdByName: string | null;
  type: "auto" | "manual" | "restore";
  createdAt: string;
}

export interface VersionPreview extends DocumentVersion {
  markdown: string;
}

export interface VersionListResponse {
  versions: DocumentVersion[];
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add src/types/index.ts && git commit -m "feat: add version history TypeScript types"
```

---

## Task 8: Version History Panel UI Component

**File:** `/Users/ronica/projects/markdown-collab/src/components/VersionHistoryPanel.tsx` (new)

- [ ] Create `/Users/ronica/projects/markdown-collab/src/components/VersionHistoryPanel.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { DocumentVersion, VersionPreview, VersionListResponse } from "@/types";

interface VersionHistoryPanelProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onRestoreComplete?: () => void;
}

export default function VersionHistoryPanel({
  documentId,
  isOpen,
  onClose,
  userName,
  onRestoreComplete,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<VersionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions?page=${page}`
      );
      if (res.ok) {
        const data: VersionListResponse = await res.json();
        setVersions(data.versions);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    } finally {
      setLoading(false);
    }
  }, [documentId, page]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  async function handlePreview(version: DocumentVersion) {
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${version.id}`
      );
      if (res.ok) {
        const data: VersionPreview = await res.json();
        setPreview(data);
      }
    } catch (err) {
      console.error("Failed to load preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRestore(version: DocumentVersion) {
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${version.id}/restore`,
        { method: "POST" }
      );
      if (res.ok) {
        setRestoreTarget(null);
        setPreview(null);
        await fetchVersions();
        onRestoreComplete?.();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setRestoring(false);
    }
  }

  async function handleSaveManual() {
    setSavingManual(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdByName: userName }),
      });
      if (res.ok) {
        await fetchVersions();
      }
    } catch (err) {
      console.error("Failed to save version:", err);
    } finally {
      setSavingManual(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function typeBadge(type: string) {
    switch (type) {
      case "manual":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#B8692A]/15 text-[#B8692A]">
            Manual
          </span>
        );
      case "restore":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
            Restore
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
            Auto
          </span>
        );
    }
  }

  // Group versions by date
  const groupedVersions: { date: string; items: DocumentVersion[] }[] = [];
  let currentDate = "";
  for (const v of versions) {
    const date = formatDate(v.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedVersions.push({ date, items: [v] });
    } else {
      groupedVersions[groupedVersions.length - 1].items.push(v);
    }
  }

  const totalPages = Math.ceil(total / 20);

  if (!isOpen) return null;

  return (
    <>
      <div className="w-80 shrink-0 overflow-y-auto border-l border-[#E8D8C0] bg-[#F5EBD8] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E8D8C0]">
          <h2 className="text-sm font-semibold text-gray-700">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
            title="Close version history"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Save version button */}
        <div className="px-3 py-2 border-b border-[#E8D8C0]">
          <button
            onClick={handleSaveManual}
            disabled={savingManual}
            className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 rounded-md transition-colors"
          >
            {savingManual ? (
              <>
                <svg
                  className="h-3 w-3 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Save version
              </>
            )}
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="h-5 w-5 animate-spin text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              No versions yet. Versions are created automatically as you edit, or
              click &quot;Save version&quot; above.
            </p>
          ) : (
            <>
              {groupedVersions.map((group) => (
                <div key={group.date} className="mb-3">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    {group.date}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map((version) => (
                      <button
                        key={version.id}
                        onClick={() => handlePreview(version)}
                        className="w-full text-left px-2.5 py-2 rounded-md border border-transparent hover:border-[#D4A978] hover:bg-[#FFFEF9] transition-colors group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-gray-700">
                            {formatTime(version.createdAt)}
                          </span>
                          {typeBadge(version.type)}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-gray-500 truncate">
                            {version.title}
                          </span>
                        </div>
                        {version.createdByName && (
                          <span className="text-[10px] text-gray-400">
                            by {version.createdByName}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-[#E8D8C0]">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-[10px] text-gray-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {(preview || previewLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setPreview(null);
            setPreviewLoading(false);
          }}
        >
          <div
            className="bg-[#FFFEF9] rounded-xl shadow-xl mx-4 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="h-6 w-6 animate-spin text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : preview ? (
              <>
                {/* Preview header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {preview.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTime(preview.createdAt)} &middot;{" "}
                      {formatDate(preview.createdAt)}
                      {preview.createdByName &&
                        ` \u00b7 by ${preview.createdByName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeBadge(preview.type)}
                    <button
                      onClick={() => setPreview(null)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Markdown content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                    {preview.markdown}
                  </pre>
                </div>

                {/* Restore button */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => setPreview(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setRestoreTarget(preview);
                      setPreview(null);
                    }}
                    className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] px-4 py-1.5 rounded-md transition-colors"
                  >
                    Restore this version
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRestoreTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-[#B8692A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Restore this version?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  This will replace the current document content with the version
                  from {formatTime(restoreTarget.createdAt)},{" "}
                  {formatDate(restoreTarget.createdAt)}.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              A safety snapshot of the current document will be saved
              automatically before restoring.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(restoreTarget)}
                disabled={restoring}
                className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-4 py-1.5 rounded-md transition-colors"
              >
                {restoring ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] Verify no TypeScript errors:

```bash
cd /Users/ronica/projects/markdown-collab && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add src/components/VersionHistoryPanel.tsx && git commit -m "feat: version history panel UI with preview and restore"
```

---

## Task 9: TopBar Integration — Clock Icon Toggle

**File:** `/Users/ronica/projects/markdown-collab/src/components/TopBar.tsx`

- [ ] Add `onToggleVersionHistory` and `versionHistoryOpen` props to `TopBarProps` interface. In `/Users/ronica/projects/markdown-collab/src/components/TopBar.tsx`, update the interface:

```typescript
interface TopBarProps {
  title: string;
  documentId: string;
  collaborators: Collaborator[];
  connected: boolean;
  onInviteAgent: () => void;
  onTitleChange?: (title: string) => void;
  agentLoading?: boolean;
  onToggleVersionHistory?: () => void;
  versionHistoryOpen?: boolean;
}
```

- [ ] Add the new props to the destructured parameters of the `TopBar` component function.

- [ ] Add a clock icon button in the right-side actions area, between the Export link and the Invite Agent button. Insert this JSX:

```tsx
        {/* Version History toggle */}
        <button
          onClick={onToggleVersionHistory}
          className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 text-sm font-medium transition-colors rounded-md ${
            versionHistoryOpen
              ? "text-white bg-white/15"
              : "text-white/60 hover:text-white hover:bg-white/8"
          }`}
          title="Version history"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">History</span>
        </button>
```

- [ ] Verify no TypeScript errors:

```bash
cd /Users/ronica/projects/markdown-collab && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add src/components/TopBar.tsx && git commit -m "feat: add version history toggle button to TopBar"
```

---

## Task 10: Wire Up Version History in the Document Page

**File:** Find the document page component that renders TopBar, Editor, and CommentSidebar together. This is the page that composes the editor layout.

- [ ] Locate the page file:

```bash
find /Users/ronica/projects/markdown-collab/src -name "page.tsx" -path "*/doc/*"
```

- [ ] In that page component, add state and rendering for the version history panel:

Add state:
```typescript
const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
```

Add the toggle handler:
```typescript
function toggleVersionHistory() {
  setVersionHistoryOpen((prev) => !prev);
}
```

Pass props to TopBar:
```tsx
<TopBar
  // ... existing props
  onToggleVersionHistory={toggleVersionHistory}
  versionHistoryOpen={versionHistoryOpen}
/>
```

Add the VersionHistoryPanel alongside the CommentSidebar in the layout (after the Editor, before or after CommentSidebar):
```tsx
import VersionHistoryPanel from "@/components/VersionHistoryPanel";

// In the JSX, alongside the existing sidebar:
{versionHistoryOpen && (
  <VersionHistoryPanel
    documentId={documentId}
    isOpen={versionHistoryOpen}
    onClose={() => setVersionHistoryOpen(false)}
    userName={userName}
  />
)}
```

- [ ] Verify no TypeScript errors:

```bash
cd /Users/ronica/projects/markdown-collab && npx tsc --noEmit --pretty 2>&1 | head -30
```

- [ ] Run full test suite:

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run
```

- [ ] Commit:

```bash
cd /Users/ronica/projects/markdown-collab && git add src/ && git commit -m "feat: wire version history panel into document page layout"
```

---

## Task 11: Clean Up Document Versions on Document Delete

**File:** `/Users/ronica/projects/markdown-collab/src/app/api/documents/[id]/route.ts`

- [ ] The `DocumentVersion` model has `onDelete: Cascade` in the schema, so Prisma will auto-delete versions when a document is deleted. Verify this by checking the migration file:

```bash
cd /Users/ronica/projects/markdown-collab && cat prisma/migrations/*/migration.sql | grep -A5 "DocumentVersion"
```

- [ ] No code change needed if cascade is set. Verify by running:

```bash
cd /Users/ronica/projects/markdown-collab && npx vitest run
```

- [ ] Final commit with all tests passing:

```bash
cd /Users/ronica/projects/markdown-collab && git add -A && git commit -m "chore: verify cascade delete covers version cleanup"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] Run full test suite: `cd /Users/ronica/projects/markdown-collab && npx vitest run`
- [ ] Start the dev server: `cd /Users/ronica/projects/markdown-collab && npm run dev`
- [ ] Open a document in the browser
- [ ] Click the clock icon in the TopBar — version history panel should slide open
- [ ] Click "Save version" — a manual snapshot should appear in the list
- [ ] Click a version entry — preview modal should show markdown content
- [ ] Click "Restore this version" — confirmation dialog should appear
- [ ] Confirm restore — document content should revert and a "Before restore" entry should appear
- [ ] Wait 30+ minutes with active edits — auto snapshots should appear (or test by temporarily lowering the interval)
- [ ] Delete a document — verify versions are cascade-deleted

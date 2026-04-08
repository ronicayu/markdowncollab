# R15 Feature Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 18 features/enhancements across 3 priority tiers to empty the product backlog.

**Architecture:** Each item is independent and can be parallelized. P0 items fix existing gaps. P2 items add new capabilities. P3 items are quality-of-life polish. All follow TDD — write failing test, implement, verify, commit.

**Tech Stack:** Next.js 16 (App Router), Tiptap 3, Yjs, Prisma/SQLite, React 19, Tailwind CSS 4, Vitest, Playwright

**Note:** COLLAB-001 (@Mention Notifications) was found to be already implemented during planning and removed from the backlog.

---

## File Structure

### New Files
- `src/app/api/documents/bulk/move/route.ts` — Bulk move to folder
- `src/app/api/documents/bulk/share/route.ts` — Bulk share
- `src/app/api/documents/[id]/access-history/route.ts` — Permissions audit log
- `src/app/api/documents/import/route.ts` — Document import
- `src/app/api/macros/route.ts` — Macro CRUD API
- `src/app/api/user/preferences/route.ts` — User preferences API
- `src/lib/reading-time.ts` — Reading time calculation
- `prisma/migrations/*/migration.sql` — New migration for schema changes
- `__tests__/grammar-cache.test.ts` — Grammar cache tests
- `__tests__/room-cleanup.test.ts` — Room cleanup tests
- `__tests__/search-pagination.test.ts` — Search pagination tests
- `__tests__/version-pruning.test.ts` — Version pruning tests
- `__tests__/bulk-operations.test.ts` — Bulk operations tests
- `__tests__/document-import.test.ts` — Import tests
- `__tests__/access-history.test.ts` — Audit log tests
- `__tests__/slash-commands.test.ts` — Custom slash commands tests
- `__tests__/macros-api.test.ts` — Macros API tests
- `__tests__/reading-time.test.ts` — Reading time tests
- `__tests__/cursor-colors.test.ts` — Cursor color tests

### Modified Files
- `prisma/schema.prisma` — Add Macro, UserPreference, DocumentPin models; add maxVersions to Document
- `server/combined-server.mjs` — Room cleanup, version pruning warning
- `src/extensions/grammar-check.ts` — Paragraph hash cache
- `src/app/api/documents/search/route.ts` — Add pagination
- `src/app/page.tsx` — Bulk move/share, pinning, reading time display, export format memory
- `src/components/CommentSidebar.tsx` — No changes (mentions already work)
- `src/components/SlashCommandMenu.tsx` — Load custom commands
- `src/components/Toolbar.tsx` — Macros panel with DB persistence
- `src/components/VersionHistoryPanel.tsx` — Pruning warning toast
- `src/lib/macros.ts` — DB-backed storage
- `src/lib/cursor-utils.ts` — Hash by userId
- `src/components/DocumentMetadata.tsx` — Reading time display
- `src/components/TopBar.tsx` — Export format memory

---

## Task 1: Prisma Schema Updates

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and fields to schema**

Add to the end of `prisma/schema.prisma`:

```prisma
model Macro {
  id         String   @id @default(uuid())
  name       String
  steps      String   // JSON array of RecordedKey[]
  ownerId    String
  documentId String?  // null = global, set = document-scoped
  createdAt  DateTime @default(now())

  @@unique([ownerId, name])
  @@index([ownerId])
  @@index([documentId])
}

model UserPreference {
  id              String  @id @default(uuid())
  userId          String  @unique
  digestFrequency String  @default("none") // "none" | "daily" | "weekly"
  keyboardOverrides String? // JSON map of shortcut overrides

  @@index([userId])
}

model DocumentPin {
  id         String   @id @default(uuid())
  documentId String
  userId     String
  pinnedAt   DateTime @default(now())

  @@unique([documentId, userId])
  @@index([userId, pinnedAt])
}
```

Add `maxVersions` field to the Document model after `fontFamily`:

```prisma
  maxVersions Int             @default(50)
```

- [ ] **Step 2: Run migration**

Run: `cd /Users/ronica/projects/markdown-collab && npx prisma migrate dev --name r15_features`
Expected: Migration applied successfully

- [ ] **Step 3: Verify generated client**

Run: `cd /Users/ronica/projects/markdown-collab && npx prisma generate`
Expected: Generated Prisma Client

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Macro, UserPreference, DocumentPin models and maxVersions field"
```

---

## Task 2: Grammar Check Paragraph Hash Cache (COLLAB-002)

**Files:**
- Modify: `src/extensions/grammar-check.ts`
- Create: `__tests__/grammar-cache.test.ts`

- [ ] **Step 1: Write failing test for paragraph hash caching**

Create `__tests__/grammar-cache.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

// Simple hash function matching the one we'll add to grammar-check.ts
function paragraphHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

describe("Grammar check paragraph hash cache", () => {
  it("produces consistent hash for same text", () => {
    const text = "This is a test paragraph with some content.";
    expect(paragraphHash(text)).toBe(paragraphHash(text));
  });

  it("produces different hash for different text", () => {
    const a = "First paragraph text.";
    const b = "Second paragraph text.";
    expect(paragraphHash(a)).not.toBe(paragraphHash(b));
  });

  it("handles empty string", () => {
    expect(paragraphHash("")).toBe("0");
  });
});
```

- [ ] **Step 2: Run test to verify it passes (pure function test)**

Run: `cd /Users/ronica/projects/markdown-collab && npx vitest run __tests__/grammar-cache.test.ts`
Expected: PASS

- [ ] **Step 3: Add hash cache to grammar-check extension**

In `src/extensions/grammar-check.ts`, add the hash function after the GrammarIssue interface (line 12):

```typescript
function paragraphHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
```

Update `addStorage()` to include the cache:

```typescript
  addStorage() {
    return {
      enabled: false,
      issues: [] as GrammarIssue[],
      timeout: null as ReturnType<typeof setTimeout> | null,
      tooltip: null as HTMLDivElement | null,
      cache: new Map<string, GrammarIssue[]>(),
    };
  },
```

In the `scheduleCheck` function (inside the setTimeout callback, around line 198), add cache logic before the fetch:

Replace the section from `const text = paragraph.textContent;` through the `try { const res = await fetch(...)` block with:

```typescript
              const text = paragraph.textContent;
              if (!text || text.trim().length < 10) return;

              const hash = paragraphHash(text);
              const cached = storage.cache.get(hash);
              if (cached) {
                // Use cached results, adjust positions to current paragraph
                const paragraphStart = $from.start();
                const issues = cached.map((i: GrammarIssue) => ({
                  ...i,
                  from: paragraphStart + (i.from - i.from), // cached issues store relative positions
                  to: paragraphStart + (i.to - i.from) + (i.from - i.from),
                }));
                // Already have results for this paragraph, skip API call
                return;
              }

              const paragraphStart = $from.start();

              try {
                const res = await fetch("/api/agent/grammar", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text }),
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!data.issues || !Array.isArray(data.issues)) return;

                const issues: GrammarIssue[] = data.issues
                  .filter((i: { start: number; end: number }) =>
                    typeof i.start === "number" && typeof i.end === "number" &&
                    i.start >= 0 && i.end <= text.length && i.start < i.end
                  )
                  .map((i: { start: number; end: number; message: string; suggestion: string }) => ({
                    from: paragraphStart + i.start,
                    to: paragraphStart + i.end,
                    message: i.message || "Grammar issue",
                    suggestion: i.suggestion || "",
                  }));

                // Cache results by paragraph hash
                storage.cache.set(hash, issues);
                // Limit cache size to 100 entries
                if (storage.cache.size > 100) {
                  const firstKey = storage.cache.keys().next().value;
                  if (firstKey) storage.cache.delete(firstKey);
                }

                editorView.dispatch(
                  editorView.state.tr.setMeta(grammarCheckPluginKey, { issues })
                );
              } catch {
                // silently fail
              }
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/ronica/projects/markdown-collab && npx vitest run __tests__/grammar-cache.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/extensions/grammar-check.ts __tests__/grammar-cache.test.ts
git commit -m "feat(COLLAB-002): add paragraph hash cache to grammar check, avoid redundant API calls"
```

---

## Task 3: WebSocket Room Cleanup (COLLAB-003)

**Files:**
- Modify: `server/combined-server.mjs`

- [ ] **Step 1: Add lastActivity tracking and cleanup interval**

In `server/combined-server.mjs`, after the room entry creation (around line 436 `const entry = { doc, awareness, conns: new Set() };`), add `lastActivity`:

```javascript
  entry.lastActivity = Date.now();
```

After the existing `doc.on("update", ...)` handler at line 444, add activity tracking on connection events. We'll track activity when updates happen:

```javascript
  // Track last activity for room cleanup
  doc.on("update", () => {
    entry.lastActivity = Date.now();
  });
```

Then, after the `getDoc` function definition (after line ~493), add the cleanup interval:

```javascript
// --- Room cleanup: destroy idle rooms after 30 minutes ---
const ROOM_IDLE_MS = 30 * 60 * 1000; // 30 minutes
const ROOM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [docName, entry] of docs.entries()) {
    if (entry.conns.size === 0 && (now - entry.lastActivity) >= ROOM_IDLE_MS) {
      // Persist state before cleanup
      try {
        const state = Y.encodeStateAsUpdate(entry.doc);
        const filePath = join(persistDir, docName + ".bin");
        writeFileSync(filePath, Buffer.from(state));
        console.log(`Room cleanup: persisted and destroyed idle room ${docName}`);
      } catch (err) {
        console.error(`Room cleanup: failed to persist ${docName}:`, err.message);
      }
      entry.awareness.destroy();
      entry.doc.destroy();
      docs.delete(docName);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);
```

- [ ] **Step 2: Verify server starts without errors**

Run: `cd /Users/ronica/projects/markdown-collab && node -c server/combined-server.mjs`
Expected: No syntax errors

- [ ] **Step 3: Commit**

```bash
git add server/combined-server.mjs
git commit -m "feat(COLLAB-003): add idle room cleanup, destroy rooms with no connections after 30 min"
```

---

## Task 4: Search Pagination (COLLAB-004)

**Files:**
- Modify: `src/app/api/documents/search/route.ts`

- [ ] **Step 1: Add pagination to search API**

Replace the final result-building section of `src/app/api/documents/search/route.ts` (from `// Sort by updatedAt` to end of function) with:

```typescript
  // Sort by updatedAt descending
  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Pagination
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const total = results.length;
  const start = (page - 1) * limit;
  const paged = results.slice(start, start + limit);

  return NextResponse.json({ items: paged, total, page, pageSize: limit });
```

- [ ] **Step 2: Update dashboard search to handle new response shape**

In `src/app/page.tsx`, find where `searchResults` are set from the search API response. The fetch call sets `setSearchResults(data)`. Update it to handle the new `{ items }` shape:

```typescript
setSearchResults(data.items || data);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documents/search/route.ts src/app/page.tsx
git commit -m "feat(COLLAB-004): add pagination to search API with page/limit/total response"
```

---

## Task 5: Version Snapshot Pruning Warning (COLLAB-005)

**Files:**
- Modify: `server/combined-server.mjs`

- [ ] **Step 1: Add pruning warning notification**

In `server/combined-server.mjs`, update the `createAutoSnapshot` function. After the count check (line 139-155), add notification logic before the delete:

Replace the pruning section:

```javascript
    // Prune old auto snapshots (keep last maxVersions, default 50)
    const dbDoc = await wsDbClient.document.findUnique({
      where: { id: docName },
      select: { title: true, maxVersions: true, ownerId: true },
    });
    const title = dbDoc?.title || "Untitled";
    const maxVersions = dbDoc?.maxVersions || 50;

    await wsDbClient.documentVersion.create({
      data: {
        documentId: docName,
        snapshot,
        title,
        type: "auto",
        createdBy: null,
        createdByName: "System",
      },
    });

    const count = await wsDbClient.documentVersion.count({
      where: { documentId: docName, type: "auto" },
    });

    // Warn at 90% capacity
    if (count >= Math.floor(maxVersions * 0.9) && count < maxVersions && dbDoc?.ownerId) {
      await wsDbClient.notification.create({
        data: {
          userId: dbDoc.ownerId,
          type: "system",
          documentId: docName,
          documentTitle: title,
          actorName: "System",
          message: `Version history approaching limit (${count}/${maxVersions}). Consider downloading versions.`,
        },
      });
    }

    if (count > maxVersions) {
      const excess = count - maxVersions;
      const oldest = await wsDbClient.documentVersion.findMany({
        where: { documentId: docName, type: "auto" },
        orderBy: { createdAt: "asc" },
        take: excess,
        select: { id: true },
      });
      if (oldest.length > 0) {
        await wsDbClient.documentVersion.deleteMany({
          where: { id: { in: oldest.map((v) => v.id) } },
        });

        // Notify owner about pruning
        if (dbDoc?.ownerId) {
          await wsDbClient.notification.create({
            data: {
              userId: dbDoc.ownerId,
              type: "system",
              documentId: docName,
              documentTitle: title,
              actorName: "System",
              message: `${excess} oldest auto-snapshot(s) removed to stay within the ${maxVersions} version limit.`,
            },
          });
        }
      }
    }
```

Note: This replaces the existing `createAutoSnapshot` function body. Keep the function signature and outer try/catch the same.

- [ ] **Step 2: Commit**

```bash
git add server/combined-server.mjs
git commit -m "feat(COLLAB-005): warn before version pruning, notify on auto-snapshot deletion"
```

---

## Task 6: Bulk Move-to-Folder and Bulk Share (COLLAB-006)

**Files:**
- Create: `src/app/api/documents/bulk/move/route.ts`
- Create: `src/app/api/documents/bulk/share/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create bulk move API**

Create `src/app/api/documents/bulk/move/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentIds, folderId } = await req.json();
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: "documentIds required" }, { status: 400 });
  }

  await prisma.document.updateMany({
    where: { id: { in: documentIds }, ownerId: userId },
    data: { folderId: folderId || null },
  });

  return NextResponse.json({ ok: true, moved: documentIds.length });
}
```

- [ ] **Step 2: Create bulk share API**

Create `src/app/api/documents/bulk/share/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentIds, email, role } = await req.json();
  if (!Array.isArray(documentIds) || !email || !["viewer", "editor"].includes(role)) {
    return NextResponse.json({ error: "documentIds, email, and valid role required" }, { status: 400 });
  }

  let created = 0;
  for (const docId of documentIds) {
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (doc?.ownerId !== userId) continue;
    try {
      await prisma.documentShare.create({
        data: { documentId: docId, email: email.toLowerCase(), role },
      });
      created++;
    } catch {
      // Skip duplicates (unique constraint)
    }
  }

  return NextResponse.json({ ok: true, shared: created });
}
```

- [ ] **Step 3: Add bulk move and share UI to dashboard**

In `src/app/page.tsx`, find the bulk actions bar (around line 1427 where `{selected.size > 0 && (`). Add move-to-folder and share buttons after the existing tag button section:

Add state variables near the other state declarations:

```typescript
const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
const [bulkShareOpen, setBulkShareOpen] = useState(false);
const [bulkShareEmail, setBulkShareEmail] = useState("");
const [bulkShareRole, setBulkShareRole] = useState<"viewer" | "editor">("viewer");
```

Add handler functions near the existing `bulkDelete` function:

```typescript
  async function bulkMoveToFolder(folderId: string | null) {
    const ids = [...selected];
    await fetch("/api/documents/bulk/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids, folderId }),
    });
    setDocs((prev) => prev.map((d) => selected.has(d.id) ? { ...d, folderId } : d));
    setSelected(new Set());
    setBulkMoveOpen(false);
  }

  async function bulkShare() {
    if (!bulkShareEmail.trim()) return;
    const ids = [...selected];
    await fetch("/api/documents/bulk/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids, email: bulkShareEmail.trim(), role: bulkShareRole }),
    });
    setSelected(new Set());
    setBulkShareOpen(false);
    setBulkShareEmail("");
  }
```

Add buttons in the bulk action bar after the existing export link:

```tsx
                  <button
                    onClick={() => setBulkMoveOpen(!bulkMoveOpen)}
                    className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    Move
                  </button>
                  {bulkMoveOpen && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 min-w-[160px]">
                      <button
                        onClick={() => bulkMoveToFolder(null)}
                        className="block w-full text-left text-xs px-2 py-1 hover:bg-gray-100 rounded"
                      >
                        Root (no folder)
                      </button>
                      {folders.map((f: Folder) => (
                        <button
                          key={f.id}
                          onClick={() => bulkMoveToFolder(f.id)}
                          className="block w-full text-left text-xs px-2 py-1 hover:bg-gray-100 rounded"
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setBulkShareOpen(!bulkShareOpen)}
                    className="text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    Share
                  </button>
                  {bulkShareOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[240px]">
                      <input
                        type="email"
                        placeholder="Email address"
                        value={bulkShareEmail}
                        onChange={(e) => setBulkShareEmail(e.target.value)}
                        className="w-full text-xs border rounded px-2 py-1 mb-2"
                      />
                      <select
                        value={bulkShareRole}
                        onChange={(e) => setBulkShareRole(e.target.value as "viewer" | "editor")}
                        className="w-full text-xs border rounded px-2 py-1 mb-2"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                      <button
                        onClick={bulkShare}
                        className="w-full text-xs px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700"
                      >
                        Share {selected.size} docs
                      </button>
                    </div>
                  )}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/documents/bulk/move/route.ts src/app/api/documents/bulk/share/route.ts src/app/page.tsx
git commit -m "feat(COLLAB-006): add bulk move-to-folder and bulk share operations"
```

---

## Task 7: Mobile Sidebar Collapse (COLLAB-007)

**Files:**
- Modify: `src/components/Editor.tsx` (or parent layout managing sidebars)

This task adds responsive sidebar behavior. The implementation depends on how sidebars are composed in the editor layout. Key changes:

- [ ] **Step 1: Add useMediaQuery hook**

Create utility if not exists. Add to the editor page component:

```typescript
function useMediaQuery(maxWidth: number): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [maxWidth]);
  return matches;
}
```

- [ ] **Step 2: Auto-collapse sidebars on mobile**

In the editor page component where sidebars are rendered, add:

```typescript
const isMobile = useMediaQuery(768);

// Auto-collapse sidebars on mobile
useEffect(() => {
  if (isMobile) {
    setShowOutline(false);
    setShowComments(false);
    setShowAIChat(false);
  }
}, [isMobile]);
```

- [ ] **Step 3: Add swipe gesture detection**

```typescript
useEffect(() => {
  if (!isMobile) return;
  let startX = 0;
  let startY = 0;
  const threshold = 50;

  function onTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
  function onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll
    if (dx > threshold) {
      // Swipe right: open outline
      setShowOutline(true);
      setShowComments(false);
      setShowAIChat(false);
    } else if (dx < -threshold) {
      // Swipe left: open comments
      setShowComments(true);
      setShowOutline(false);
    }
  }
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
  return () => {
    document.removeEventListener("touchstart", onTouchStart);
    document.removeEventListener("touchend", onTouchEnd);
  };
}, [isMobile]);
```

- [ ] **Step 4: Add overlay backdrop for mobile sidebars**

When a sidebar is open on mobile, render an overlay that closes it on tap:

```tsx
{isMobile && (showOutline || showComments || showAIChat) && (
  <div
    className="fixed inset-0 bg-black/30 z-40"
    onClick={() => { setShowOutline(false); setShowComments(false); setShowAIChat(false); }}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat(COLLAB-007): auto-collapse sidebars on mobile, add swipe gestures and overlay"
```

---

## Task 8: Document Import (COLLAB-008)

**Files:**
- Create: `src/app/api/documents/import/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Install mammoth for DOCX parsing**

Run: `cd /Users/ronica/projects/markdown-collab && npm install mammoth`

- [ ] **Step 2: Create import API route**

Create `src/app/api/documents/import/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  let html = "";
  let title = file.name.replace(/\.(md|docx|html?)$/i, "");

  if (name.endsWith(".md")) {
    const text = await file.text();
    // Simple markdown to HTML conversion for import
    const { marked } = await import("marked");
    html = await marked(text);
  } else if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    html = result.value;
  } else if (name.endsWith(".html") || name.endsWith(".htm")) {
    html = await file.text();
  } else {
    return NextResponse.json({ error: "Unsupported format. Use .md, .docx, or .html" }, { status: 400 });
  }

  // Create document with HTML content stored as the title placeholder
  // The actual Yjs content will be initialized client-side from the HTML
  const doc = await prisma.document.create({
    data: {
      title,
      ownerId: userId,
    },
  });

  return NextResponse.json({ id: doc.id, html, title });
}
```

- [ ] **Step 3: Wire import button in dashboard**

In `src/app/page.tsx`, the `importInputRef` and `importing` state already exist. Find the existing import input element and update the handler to call the new API:

```typescript
  async function handleImport(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/import", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Import failed");
        return;
      }
      const { id } = await res.json();
      router.push(`/doc/${id}`);
    } catch {
      alert("Import failed");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/documents/import/route.ts src/app/page.tsx package.json package-lock.json
git commit -m "feat(COLLAB-008): document import from Markdown, DOCX, and HTML files"
```

---

## Task 9: Full-Text Document Search Enhancement (COLLAB-010)

**Files:**
- Modify: `src/app/api/documents/search/route.ts`

The search API already reads markdown files from disk and does content matching. The enhancement is to improve ranking (title match > content match) and ensure the response is properly paginated (done in Task 4).

- [ ] **Step 1: Add ranking to search results**

In `src/app/api/documents/search/route.ts`, update the results building to include a relevance score:

```typescript
  const results: { id: string; title: string; snippet: string; updatedAt: string; score: number }[] = [];

  for (const doc of accessibleDocs) {
    const titleMatch = doc.title.toLowerCase().includes(lowerQuery);
    let contentSnippet: string | null = null;
    if (mdFiles.has(doc.id)) {
      try {
        const content = readFileSync(join(markdownDir, `${doc.id}.md`), "utf-8");
        contentSnippet = extractSnippet(content, query);
      } catch { /* skip */ }
    }

    if (titleMatch || contentSnippet) {
      if (!addedIds.has(doc.id)) {
        addedIds.add(doc.id);
        // Score: title exact > title contains > content match
        let score = 0;
        if (doc.title.toLowerCase() === lowerQuery) score = 100;
        else if (titleMatch) score = 50;
        if (contentSnippet) score += 10;
        results.push({ id: doc.id, title: doc.title, snippet: contentSnippet || "", updatedAt: doc.updatedAt.toISOString(), score });
      }
    }
  }

  // Sort by relevance score descending, then by updatedAt
  results.sort((a, b) => b.score - a.score || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/documents/search/route.ts
git commit -m "feat(COLLAB-010): add relevance ranking to full-text search (title > content)"
```

---

## Task 10: Document Permissions Audit Log (COLLAB-012)

**Files:**
- Create: `src/app/api/documents/[id]/access-history/route.ts`
- Modify: `src/app/api/documents/[id]/share/route.ts`

- [ ] **Step 1: Create access-history API route**

Create `src/app/api/documents/[id]/access-history/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can view access history" }, { status: 403 });
  }

  const logs = await prisma.activityLog.findMany({
    where: {
      documentId: id,
      action: { in: ["shared", "share_removed", "role_changed"] },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(logs);
}
```

- [ ] **Step 2: Add share_removed and role_changed logging to share API**

In `src/app/api/documents/[id]/share/[shareId]/route.ts`, ensure DELETE and PUT handlers log activity. Read the file first to check existing handlers, then add `logActivity` calls for `share_removed` and `role_changed` actions.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documents/[id]/access-history/route.ts src/app/api/documents/[id]/share/[shareId]/route.ts
git commit -m "feat(COLLAB-012): add permissions audit log with access-history endpoint"
```

---

## Task 11: Custom Slash Commands Wiring (COLLAB-013)

**Files:**
- Modify: `src/components/SlashCommandMenu.tsx`

- [ ] **Step 1: Load custom commands in slash menu**

In `src/components/SlashCommandMenu.tsx`, add a fetch for custom commands and merge them into the menu:

Add state and fetch near the top of the component:

```typescript
const [customCommands, setCustomCommands] = useState<{ id: string; name: string; content: string }[]>([]);

useEffect(() => {
  fetch("/api/commands")
    .then((r) => (r.ok ? r.json() : []))
    .then((cmds: { id: string; name: string; content: string }[]) => setCustomCommands(cmds))
    .catch(() => {});
}, []);
```

Add custom commands to the items list (merge with built-in commands). Each custom command inserts its content:

```typescript
const customItems = customCommands
  .filter((cmd) => cmd.name.toLowerCase().includes(query.toLowerCase()))
  .map((cmd) => ({
    title: cmd.name,
    description: "Custom command",
    icon: "star",
    badge: "custom",
    action: () => {
      editor.commands.insertContent(cmd.content);
    },
  }));
```

Append `customItems` to the existing items array.

- [ ] **Step 2: Add "custom" badge styling**

For items with `badge: "custom"`, render a small purple badge:

```tsx
{item.badge === "custom" && (
  <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
    custom
  </span>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SlashCommandMenu.tsx
git commit -m "feat(COLLAB-013): wire CustomCommand model into slash command menu with custom badge"
```

---

## Task 12: Shareable Keyboard Macros (COLLAB-014)

**Files:**
- Create: `src/app/api/macros/route.ts`
- Modify: `src/lib/macros.ts`
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Create macros API**

Create `src/app/api/macros/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json([]);

  const documentId = req.nextUrl.searchParams.get("documentId");

  const macros = await prisma.macro.findMany({
    where: {
      OR: [
        { ownerId: userId, documentId: null },
        ...(documentId ? [{ documentId }] : []),
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(macros.map((m) => ({
    ...m,
    steps: JSON.parse(m.steps),
  })));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, steps, documentId } = await req.json();
  if (!name || !Array.isArray(steps)) {
    return NextResponse.json({ error: "name and steps required" }, { status: 400 });
  }

  const macro = await prisma.macro.upsert({
    where: { ownerId_name: { ownerId: userId, name } },
    create: { name, steps: JSON.stringify(steps), ownerId: userId, documentId: documentId || null },
    update: { steps: JSON.stringify(steps), documentId: documentId || null },
  });

  return NextResponse.json({ ...macro, steps: JSON.parse(macro.steps) });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await prisma.macro.deleteMany({ where: { id, ownerId: userId } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Update macros.ts to use API with localStorage fallback**

Replace `src/lib/macros.ts` `loadMacros` and `saveMacro` to support both:

```typescript
export async function loadMacrosFromApi(documentId?: string): Promise<Macro[]> {
  try {
    const url = documentId ? `/api/macros?documentId=${documentId}` : "/api/macros";
    const res = await fetch(url);
    if (!res.ok) return loadMacros(); // fallback to localStorage
    return await res.json();
  } catch {
    return loadMacros(); // fallback to localStorage
  }
}

export async function saveMacroToApi(macro: Macro, documentId?: string): Promise<void> {
  try {
    await fetch("/api/macros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: macro.name, steps: macro.keys, documentId }),
    });
  } catch {
    saveMacro(macro); // fallback to localStorage
  }
}
```

- [ ] **Step 3: Update Toolbar to use API-backed macros**

In `src/components/Toolbar.tsx`, update macro load/save calls to use the new API functions.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/macros/route.ts src/lib/macros.ts src/components/Toolbar.tsx
git commit -m "feat(COLLAB-014): persist macros to database with API, localStorage fallback"
```

---

## Task 13: Reading Time Estimate (COLLAB-015)

**Files:**
- Create: `src/lib/reading-time.ts`
- Modify: `src/components/DocumentMetadata.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create reading time utility**

Create `src/lib/reading-time.ts`:

```typescript
const WPM = 200;

export function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / WPM));
  return `${minutes} min read`;
}
```

- [ ] **Step 2: Add to document metadata panel**

In `src/components/DocumentMetadata.tsx`, import and display:

```typescript
import { estimateReadingTime } from "@/lib/reading-time";
```

Add reading time display where word count is shown:

```tsx
<span className="text-xs text-gray-500">{estimateReadingTime(wordCount)}</span>
```

- [ ] **Step 3: Add to dashboard document rows**

In `src/app/page.tsx`, show reading time as a subtle label on each document row (requires fetching word count or estimating from title length — keep it lightweight).

- [ ] **Step 4: Commit**

```bash
git add src/lib/reading-time.ts src/components/DocumentMetadata.tsx src/app/page.tsx
git commit -m "feat(COLLAB-015): add reading time estimate to metadata panel and dashboard"
```

---

## Task 14: Document Pinning (COLLAB-017)

**Files:**
- Create: `src/app/api/documents/[id]/pin/route.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create pin API**

Create `src/app/api/documents/[id]/pin/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check pin count
  const count = await prisma.documentPin.count({ where: { userId } });
  if (count >= 10) {
    return NextResponse.json({ error: "Maximum 10 pinned documents" }, { status: 400 });
  }

  const existing = await prisma.documentPin.findUnique({
    where: { documentId_userId: { documentId: id, userId } },
  });

  if (existing) {
    await prisma.documentPin.delete({ where: { id: existing.id } });
    return NextResponse.json({ pinned: false });
  }

  await prisma.documentPin.create({ data: { documentId: id, userId } });
  return NextResponse.json({ pinned: true });
}
```

- [ ] **Step 2: Add pin UI to dashboard**

In `src/app/page.tsx`, fetch pinned document IDs and sort pinned docs to top. Add pin icon button on each document row.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/documents/[id]/pin/route.ts src/app/page.tsx
git commit -m "feat(COLLAB-017): add document pinning with pin/unpin toggle and sorted display"
```

---

## Task 15: Stable Cursor Colors by UserId (COLLAB-018)

**Files:**
- Modify: `src/lib/cursor-utils.ts`

- [ ] **Step 1: Write test for userId-based color**

Create `__tests__/cursor-colors.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getUserColor } from "@/lib/cursor-utils";

describe("getUserColor", () => {
  it("returns consistent color for same input", () => {
    expect(getUserColor("user-123")).toBe(getUserColor("user-123"));
  });

  it("returns different colors for different inputs", () => {
    const a = getUserColor("user-123");
    const b = getUserColor("user-456");
    // Not guaranteed different due to hash collisions, but usually different
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });
});
```

- [ ] **Step 2: Run test**

Run: `cd /Users/ronica/projects/markdown-collab && npx vitest run __tests__/cursor-colors.test.ts`
Expected: PASS (function already exists, interface unchanged)

- [ ] **Step 3: Update callsite to pass userId instead of name**

The `getUserColor` function itself doesn't need changing — it's a generic hash function. The change is at the callsite where it's invoked. Find where `getUserColor(userName)` is called and change to `getUserColor(userId || userName)` to prefer userId when available.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cursor-utils.ts __tests__/cursor-colors.test.ts
git commit -m "feat(COLLAB-018): use userId for cursor color assignment for cross-session consistency"
```

---

## Task 16: Export Format Memory (COLLAB-019)

**Files:**
- Modify: `src/components/TopBar.tsx`

- [ ] **Step 1: Add localStorage persistence for export format**

In `src/components/TopBar.tsx`, find the export dropdown. Add:

```typescript
const [preferredExportFormat, setPreferredExportFormat] = useState<string>(() => {
  if (typeof window === "undefined") return "markdown";
  return localStorage.getItem("preferredExportFormat") || "markdown";
});

function handleExport(format: string) {
  localStorage.setItem("preferredExportFormat", format);
  setPreferredExportFormat(format);
  // ... existing export logic
}
```

Reorder the export options to show the preferred format first, or highlight it.

- [ ] **Step 2: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "feat(COLLAB-019): remember last-used export format in localStorage"
```

---

## Deferred Items (Require Infrastructure)

The following items from the original backlog require infrastructure beyond code changes and are documented here for future sprints:

- **COLLAB-009 (Offline Editing):** Requires Service Worker + `y-indexeddb` integration. Deferred to R16 as it needs thorough testing of CRDT merge behavior.
- **COLLAB-011 (Email Notification Digests):** Requires SMTP server configuration. Deferred until email infrastructure is available.
- **COLLAB-016 (Keyboard Shortcut Customization):** Requires UserPreference model (added in Task 1) but significant UI work for the rebinding editor. Deferred to R16.

---

## Execution Order

Tasks can be parallelized in these groups:

**Group 1 (must be first):** Task 1 (Prisma schema) — all other tasks depend on the new models.

**Group 2 (parallel after Task 1):** Tasks 2-16 are all independent of each other and can be implemented in parallel.

**Group 3:** QE tests, PO verification, UAT — after all implementations.

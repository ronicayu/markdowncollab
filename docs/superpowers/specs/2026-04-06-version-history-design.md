# Version History

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Safety net for collaborative editing

## Problem

If someone wrecks a document, there's no way to recover. Yjs stores the full operation log internally but there's no UI to browse or restore previous states. Users need confidence that they can undo mistakes.

## Design

### Approach

Leverage Yjs snapshots rather than storing full document copies. Yjs already tracks all operations — we just need to snapshot at meaningful points and provide a UI to browse them.

### Data Model

```prisma
model DocumentVersion {
  id          String   @id @default(uuid())
  documentId  String
  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  snapshot    Bytes                    // Yjs encodeSnapshot()
  title       String                   // Document title at snapshot time
  createdBy   String?                  // User ID who triggered save
  createdByName String?                // Display name
  type        String   @default("auto") // "auto" | "manual" | "restore"
  createdAt   DateTime @default(now())

  @@index([documentId, createdAt])
}
```

### Snapshot Strategy

**Auto snapshots:**
- Every 30 minutes of active editing (debounced)
- On document close (last WebSocket client disconnects)
- Keep last 50 auto snapshots per document, prune older ones

**Manual snapshots:**
- User clicks "Save version" in version history panel
- Named by user (optional, defaults to timestamp)
- Never auto-pruned

**Restore snapshots:**
- Created automatically before any restore operation
- Labeled "Before restore to [date]"
- Never auto-pruned

### API

**`GET /api/documents/[id]/versions`**
- Returns list of versions (id, title, createdByName, type, createdAt)
- Paginated (20 per page)
- Requires viewer role or above

**`GET /api/documents/[id]/versions/[versionId]`**
- Returns rendered markdown preview of the snapshot
- Applies snapshot to a temporary Yjs doc, converts to markdown
- Requires viewer role or above

**`POST /api/documents/[id]/versions`**
- Creates manual snapshot
- Body: `{ name?: string }`
- Requires editor role or above

**`POST /api/documents/[id]/versions/[versionId]/restore`**
- Creates "before restore" snapshot first
- Applies stored snapshot to current Yjs doc
- Broadcasts update to all connected clients
- Requires editor role or above

### WebSocket Server Changes

In `server/combined-server.mjs`:
- Track last snapshot time per document
- On update, if >30 min since last snapshot and document has active edits, create auto snapshot
- On last client disconnect, create auto snapshot
- Pruning runs on snapshot creation (delete oldest auto snapshots beyond 50)

### UI

**Version History Panel:**
- Slide-out panel from right side (like comments sidebar)
- Toggle button in TopBar: clock icon
- Lists versions grouped by date
- Each entry shows: time, author name, type badge (auto/manual/restore)
- Click to preview (read-only markdown render in panel)
- "Restore" button on each version (with confirmation dialog)
- "Save version" button at top of panel

**Version Preview:**
- Read-only rendered markdown in a modal or split view
- "Restore this version" CTA
- "Close" button

### Storage Considerations

Yjs snapshots are compact (they reference the operation log, not full content). Typical snapshot is <1KB for a 10-page document. 50 auto + unlimited manual snapshots per doc is well within SQLite's comfort zone.

## Team Debate Notes

**SWE 2 challenged:** "Why not just store full markdown copies? Simpler to implement."
**SWE 1 response:** "Markdown copies lose Yjs state — comments, suggestions, cursor positions. Snapshots preserve everything and are smaller."
**Consensus:** Yjs snapshots. The complexity is worth the fidelity.

**PM challenged:** "Do we need diff view between versions?"
**SWE 1 response:** "Nice to have but significant scope. Preview + restore covers the core need."
**Consensus:** Defer diff view. Preview + restore for v1.

## Testing Strategy

- Unit test snapshot creation and restoration
- Test auto-pruning logic (>50 auto snapshots)
- Test restore creates "before restore" snapshot
- Integration test: edit doc → snapshot → edit more → restore → verify content

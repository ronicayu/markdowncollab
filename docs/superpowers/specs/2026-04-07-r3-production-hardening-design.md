# Round 3: Production Hardening

**Date:** 2026-04-07
**Status:** Approved (internal team consensus)
**Priority:** P0 — Required before real team adoption

## Overview

Seven features focused on making the editor production-ready for a 10-person team. No new flashy features — fix what's broken, add safety nets, improve findability, polish for production.

---

## Feature 1: Fix Collaboration Cursors

### Problem
CollaborationCursor is disabled because Tiptap v3's extension requires `TiptapCollabProvider` but we use `y-websocket`'s `WebsocketProvider`. The extension crashes accessing `provider.doc`.

### Design
Instead of migrating the entire provider, implement a custom cursor rendering solution using Yjs awareness directly. The awareness protocol already syncs user presence (name, color, cursor position). We just need to render remote cursors as decorations in ProseMirror.

**Approach:** Create a custom Tiptap extension that:
1. Listens to awareness changes on the provider
2. For each remote user with a cursor position, creates ProseMirror decorations (colored caret + name label)
3. Updates decorations on awareness change events

This avoids the TiptapCollabProvider dependency entirely and works with our existing y-websocket setup.

### Key Files
- New: `src/extensions/remote-cursors.ts` — custom extension
- Modify: `src/components/Editor.tsx` — add extension, remove old CollaborationCursor import
- Modify: `src/app/globals.css` — cursor styles

---

## Feature 2: Trash / Soft Delete

### Problem
Deleted documents are gone forever. No recovery possible. Users fear the delete button.

### Design
Add `deletedAt` timestamp to Document model. "Delete" sets the timestamp instead of removing the record. Add a "Trash" tab in the document list. Documents in trash can be restored or permanently deleted after 30 days.

### Data Model
```prisma
model Document {
  ...existing fields...
  deletedAt DateTime?    // null = active, set = in trash
}
```

### API Changes
- `DELETE /api/documents/[id]` — Sets `deletedAt` instead of deleting
- `POST /api/documents/[id]/restore` — Clears `deletedAt`
- `DELETE /api/documents/[id]/permanent` — Actually deletes (owner only, must be in trash)
- `GET /api/documents` — Filter out `deletedAt IS NOT NULL` by default
- New query param: `?trash=true` — Returns only trashed documents

### UI
- Add "Trash" tab in sidebar (below "Shared with me")
- Trash view shows deleted documents with "Restore" and "Delete permanently" buttons
- "Delete permanently" has confirmation dialog
- Show "Deleted X days ago" timestamp
- Auto-purge: cron or on-load cleanup of documents deleted > 30 days ago

---

## Feature 3: Document Search (Full-Text)

### Problem
Document list only filters by title via the search box. Can't search document content. With 50+ documents, finding things is painful.

### Design
Use SQLite FTS5 for full-text search on document content. Since content lives in Yjs binary files (not Prisma), we need to index the markdown exports.

**Approach:**
1. Add a `DocumentIndex` table with `documentId` and `content` (plain text)
2. Update the index when documents are saved (in the WebSocket server's debounced save)
3. Search API queries the index using LIKE or FTS5

**Simpler alternative (chosen):** Since we already export markdown to `documents/{id}.md` on every save, search those files directly using the API. No new database table needed.

### API
- `GET /api/documents/search?q=search+terms` — Returns matching documents
- Searches both title (from Prisma) and content (from markdown files)
- Returns: `[{ id, title, snippet, updatedAt }]` where snippet shows matching context

### UI
- Enhance the existing search input on the document list page
- Debounce search input (300ms)
- Show results with highlighted match snippets
- "Search in document titles and content"

---

## Feature 4: Rate Limiting on Agent API

### Problem
The `/api/agent/invite` endpoint calls the Anthropic API with no rate limiting. One user could trigger unlimited API calls, causing cost explosion.

### Design
Simple in-memory rate limiter using a Map of user/IP to request timestamps. No external dependency needed for a 10-person team.

### Implementation
- New: `src/lib/rate-limiter.ts` — Token bucket rate limiter
- Rate limit: 5 agent invocations per user per hour
- Rate limit: 20 upload requests per user per minute
- Returns 429 Too Many Requests when exceeded
- Header: `Retry-After: <seconds>`

### Applied To
- `POST /api/agent/invite` — 5/hour per user
- `POST /api/documents/[id]/upload` — 20/minute per user

---

## Feature 5: Error Boundaries

### Problem
If any React component crashes, the entire page shows a white screen or Next.js error overlay. No graceful degradation.

### Design
Add React Error Boundaries around the main page sections so a crash in one area doesn't take down the whole page.

### Implementation
- New: `src/components/ErrorBoundary.tsx` — Reusable error boundary with fallback UI
- Wrap: Editor, CommentSidebar, OutlineSidebar, VersionHistoryPanel each in their own boundary
- Fallback shows: "Something went wrong. [Reload]" message
- Log errors to console (Sentry integration deferred)

---

## Feature 6: Starred/Pinned Documents

### Problem
No way to mark frequently-used documents. With 50+ docs, the most important ones get buried.

### Design
Add a star/pin toggle on documents. Starred documents appear at the top of the "All Documents" list.

### Data Model
```prisma
model DocumentStar {
  id         String   @id @default(uuid())
  documentId String
  userId     String
  createdAt  DateTime @default(now())

  @@unique([documentId, userId])
}
```

### API
- `POST /api/documents/[id]/star` — Toggle star
- Stars are per-user (your stars don't affect other users)

### UI
- Star icon on each document in the list
- Starred documents float to top of list (before sort)
- "Starred" filter option in sidebar

---

## Feature 7: Env Validation at Startup

### Problem
Missing environment variables cause silent failures. `ANTHROPIC_API_KEY` unset → agent returns 503. `NEXTAUTH_SECRET` unset → auth fails silently.

### Design
Validate required env vars at server startup. Log warnings for optional vars. Fail fast if critical vars are missing.

### Implementation
- New: `src/lib/env-check.ts` — Validation function
- Called from `server/combined-server.mjs` at startup
- Required: `DATABASE_URL`, `NEXTAUTH_SECRET`
- Optional (warn if missing): `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Prints clear error messages with instructions

---

## Testing Strategy

Each feature gets unit tests. Error boundaries get component tests. Rate limiter gets timing tests. Search gets integration tests with fixture markdown files.

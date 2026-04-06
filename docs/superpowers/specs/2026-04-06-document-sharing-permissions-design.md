# Document Sharing & Permissions

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P0 — Blocker for team adoption

## Problem

Every authenticated user can see every document. There's no way to control access. This is a non-starter for any team larger than 3 people.

## Design

### Data Model

Add to Prisma schema:

```prisma
model DocumentShare {
  id         String   @id @default(uuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId     String?
  email      String?
  role       String   @default("viewer") // "viewer" | "editor" | "owner"
  shareToken String?  @unique            // For link-based sharing
  createdAt  DateTime @default(now())

  @@unique([documentId, userId])
  @@unique([documentId, email])
  @@index([shareToken])
}
```

Update Document model:
```prisma
model Document {
  id        String          @id @default(uuid())
  title     String          @default("Untitled")
  ownerId   String?                                // Creator's user ID
  visibility String         @default("private")    // "private" | "anyone_with_link"
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
  shares    DocumentShare[]
}
```

### Roles

| Role | View | Edit | Comment | Share | Delete |
|------|------|------|---------|-------|--------|
| viewer | yes | no | yes | no | no |
| editor | yes | yes | yes | no | no |
| owner | yes | yes | yes | yes | yes |

### Access Resolution

Priority order:
1. Document owner → full access
2. Explicit share (by userId or email) → role-based access
3. Share link token → viewer or editor (configurable)
4. Default → no access

### API Changes

**New endpoint: `POST /api/documents/[id]/share`**
- Body: `{ email: string, role: "viewer" | "editor" }`
- Creates DocumentShare record
- Only owner can share
- Returns share details

**New endpoint: `DELETE /api/documents/[id]/share/[shareId]`**
- Removes a share
- Only owner can remove shares

**New endpoint: `POST /api/documents/[id]/share-link`**
- Toggles link sharing on/off
- Body: `{ enabled: boolean, role: "viewer" | "editor" }`
- Generates/revokes shareToken
- Returns share URL

**New endpoint: `GET /api/documents/[id]/share`**
- Returns list of shares for a document
- Only owner can view

**Modify: `GET /api/documents`**
- Filter to only show documents user owns or has been shared with
- Add `role` field to response

**Modify: `GET /api/documents/[id]`**
- Check access before returning
- Return 403 if no access

**New middleware: `checkDocumentAccess(documentId, userId, requiredRole)`**
- Reusable access check function
- Used in all document API routes and WebSocket connection

### WebSocket Access Control

In `server/combined-server.mjs`, validate access on WebSocket upgrade:
- Parse JWT from query param or cookie
- Check document access via `checkDocumentAccess()`
- Reject connection with 403 if no access
- Pass role to awareness state so UI can show read-only mode

### UI Changes

**Share Dialog (TopBar):**
- Replace current "copy URL" share button with a share dialog
- Email input + role dropdown + "Share" button
- List of current shares with role and remove button
- Toggle for "Anyone with the link can view/edit"
- Copy link button

**Document List:**
- Add "Shared with me" tab alongside "All Documents" and "Recent"
- Show owner avatar/name on shared documents
- Show role badge (viewer/editor)

**Editor (read-only mode):**
- When role is "viewer": disable editor, hide toolbar, show "View only" badge
- Comments still work for viewers
- Suggestions disabled for viewers

### Migration

- Add `ownerId` to existing documents (set to null for legacy docs — they remain accessible to all until claimed)
- Legacy documents with no owner behave as "anyone_with_link" for backward compatibility
- Add migration script to assign ownership based on first creator if possible

## Team Debate Notes

**SWE 2 challenged:** "Do we need email-based sharing? Can't we just do link sharing?"
**PM response:** "Link sharing alone means no role control per person. Email sharing is table stakes for any doc tool."
**Consensus:** Both link sharing AND email-based sharing. Link sharing is the quick path, email sharing is the proper path.

**QE challenged:** "How do we test WebSocket access control?"
**SWE 1 response:** "Integration test that connects to WS with and without valid tokens. Mock the JWT verification."
**Consensus:** WebSocket access tests are part of the E2E test suite (Feature 7).

## Testing Strategy

- Unit tests for `checkDocumentAccess()` with all role combinations
- API route tests for share CRUD operations
- Integration test for document list filtering
- Manual verification of share dialog UX

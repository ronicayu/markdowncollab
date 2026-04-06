# Notifications

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P2 — Collaboration awareness

## Problem

Users don't know when someone comments on their document, replies to their comment, or makes edits. They have to manually check. This reduces the value of collaboration features.

## Design

### Approach

In-app notification system stored in the database. No email/push notifications in v1 — just a notification bell in the UI with a dropdown. Simple, no external dependencies.

### Data Model

```prisma
model Notification {
  id          String   @id @default(uuid())
  userId      String                              // Recipient
  type        String                              // "comment" | "reply" | "mention" | "share" | "suggestion"
  documentId  String
  documentTitle String                            // Denormalized for display
  actorName   String                              // Who triggered it
  actorId     String?                             // Actor's user ID
  message     String                              // Human-readable description
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([userId, read, createdAt])
}
```

### Notification Triggers

| Event | Recipients | Message |
|-------|-----------|---------|
| New comment | Document owner + editors | "{actor} commented on {doc}" |
| Reply to comment | Original comment author | "{actor} replied to your comment on {doc}" |
| Document shared | Share recipient | "{actor} shared {doc} with you" |
| Suggestion added | Document owner + editors | "{actor} added a suggestion on {doc}" |
| Suggestion accepted/rejected | Suggestion author | "Your suggestion on {doc} was {accepted/rejected}" |

### API

**`GET /api/notifications`**
- Returns notifications for current user
- Query params: `?unread=true`, `?limit=20`, `?cursor=<id>`
- Sorted by createdAt DESC

**`POST /api/notifications/read`**
- Body: `{ ids: string[] }` or `{ all: true }`
- Marks notifications as read

**`GET /api/notifications/count`**
- Returns `{ unread: number }`
- Used for badge count polling

### Notification Creation

Server-side function `createNotification()` called from:
- Comment creation (in Yjs update handler or API route)
- Share creation (in share API route)
- Suggestion status change (in suggestion update handler)

Since comments and suggestions live in Yjs (not the API), we need a hook in the WebSocket server:
- Listen for changes to the `comments` and `suggestions` Y.Maps
- On new entry or status change, create notifications for relevant users
- Requires knowing document ownership — query Prisma from WS server

### UI

**Notification Bell (TopBar on document list page):**
- Bell icon with unread count badge (red dot with number)
- Click opens dropdown panel
- Each notification: actor avatar placeholder, message, relative time, unread dot
- Click notification → navigate to document (and specific comment if applicable)
- "Mark all as read" button at top

**Polling Strategy:**
- Poll `/api/notifications/count` every 30 seconds when tab is active
- Full notification list fetched on dropdown open
- Use `visibilitychange` event to pause polling when tab is hidden

### Why Not WebSocket for Notifications?

The current WebSocket is per-document (you connect when you open a doc). Notifications are cross-document. Adding a global notification WebSocket is significant complexity. Polling every 30s is simple, reliable, and good enough for v1.

## Team Debate Notes

**SWE 2 challenged:** "30-second polling is wasteful. Why not Server-Sent Events?"
**SWE 1 response:** "SSE requires keeping a connection open per user globally. With our single-process architecture, that limits concurrent users. A lightweight GET every 30s is negligible load and simpler to implement."
**Consensus:** Polling for v1. SSE or WebSocket when we scale.

**PM challenged:** "Should we support @mentions in comments?"
**SWE 1 response:** "Mentions require an autocomplete UI in the comment input, user lookup, and special rendering. It's a feature in itself."
**PM response:** "Fair. Let's include the 'mention' notification type in the schema for forward compatibility but not implement mention parsing in v1."
**Consensus:** Schema includes 'mention' type. No mention parsing in v1.

**QE challenged:** "How do we test notifications created from Yjs updates?"
**SWE 1 response:** "Integration test: connect to WS, add a comment to Y.Map, verify notification created in DB."
**Consensus:** Part of E2E test suite.

## Testing Strategy

- Unit test `createNotification()` for each trigger type
- API tests for notification CRUD
- Test unread count accuracy
- Test polling behavior (active vs hidden tab)
- Integration test: comment → notification created

# @Mentions in Comments

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Close the collaboration loop

## Problem

Users can't tag specific people in comments. When you want someone to review a section or respond to a question, you have to tell them out-of-band. @mentions are the standard way to direct attention in collaborative tools.

## Design

### Approach

Add @mention support to the comment input in CommentSidebar. When a user types `@`, show an autocomplete dropdown of users who have access to the document. Selecting a user inserts a mention and triggers a notification.

### User List Source

Query users who have access to the current document:
- Document owner
- Users with explicit shares (DocumentShare records)
- Current online collaborators (from Yjs awareness)

### API

**`GET /api/documents/[id]/collaborators`**
- Returns list of users with access to the document
- Response: `[{ id, name, email }]`
- Includes: owner + share recipients + currently connected users
- Requires viewer role

### Comment Input Changes

In `src/components/CommentSidebar.tsx`, modify the comment text input:
1. Listen for `@` character typed
2. Show autocomplete dropdown below the cursor position
3. Filter list as user types more characters after `@`
4. On selection: insert `@{name}` as styled text and store the mention metadata
5. On submit: extract mentions from comment text, create notifications

### Mention Data

Store mentions as part of the comment content string using a simple format:
`@[User Name](user-id)` — similar to markdown link syntax.

When rendering comments in CommentCard.tsx, parse this format and render mentions as styled spans (bold, colored).

### Notification Integration

When a comment containing mentions is created:
1. Parse mentions from the comment text
2. For each mentioned user, call `createNotification()` with type `"mention"`
3. The notification message: "{actor} mentioned you in a comment on {doc}"

This uses the existing notification system — no new infrastructure needed.

### Autocomplete UI

```
┌──────────────────────┐
│ @jo                  │  ← Comment input
├──────────────────────┤
│ 👤 John Smith        │  ← Autocomplete dropdown
│ 👤 Joan Williams     │
└──────────────────────┘
```

- Positioned below the input
- Filtered by typed text after `@`
- Keyboard navigation (up/down arrows, Enter to select, Escape to dismiss)
- Click to select
- Max 5 results shown

### Mention Styling in Comments

```css
.mention {
  color: #b4783c;
  font-weight: 600;
  cursor: default;
}
```

## Team Debate Notes

**SWE 2 challenged:** "Should mentions work in the document body too, not just comments?"
**SWE 1 response:** "Document body mentions require a Tiptap extension (Mention node), custom rendering, and Yjs sync. Much bigger scope. Comment-only mentions cover 90% of the use case."
**Consensus:** Comments only for v1. Document body mentions later.

**PM challenged:** "What if the mentioned user doesn't have access to the doc?"
**SWE 1 response:** "The collaborators endpoint only returns users with access. You can't mention someone who can't see the document."
**Consensus:** Mention autocomplete is scoped to users with document access.

## Testing Strategy

- Unit test mention parsing (`@[Name](id)` → structured data)
- Unit test autocomplete filtering
- API test: collaborators endpoint returns correct users
- Test notification creation on mention
- E2E test: type `@` in comment, select user, submit, verify notification

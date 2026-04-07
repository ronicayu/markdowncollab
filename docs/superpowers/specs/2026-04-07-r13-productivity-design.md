# Round 13: Productivity Features

**Date:** 2026-04-07

## Feature 1: Snippet Library
Reusable text blocks saved by the user for quick insertion.
- New Prisma model: Snippet (id, title, content, ownerId, createdAt)
- API: GET/POST/DELETE /api/snippets
- Slash command: `/snippet` → shows user's saved snippets
- "Save selection as snippet" option in context/right-click or toolbar
- Insert snippet at cursor position

## Feature 2: Document Bookmarks
Named scroll positions within a document for quick navigation.
- Stored in localStorage per document: `bookmarks:{docId}` → [{name, position}]
- Toolbar button or keyboard shortcut to add bookmark at current position
- Bookmark list in outline sidebar (below headings)
- Click to scroll to bookmarked position

## Feature 3: Breadcrumb Navigation
Show the folder path in the editor TopBar for documents inside folders.
- Fetch document's folderId → resolve folder path (parent chain)
- Display as clickable breadcrumbs: Home > Folder > Subfolder > Doc Title
- Click any breadcrumb to navigate to that folder's document list

## Feature 4: Personal Highlights
Private color highlights visible only to the current user (not synced via Yjs).
- Use ProseMirror decorations (local-only, not part of document state)
- Store in localStorage per document: `highlights:{docId}`
- Highlight colors: yellow, blue, pink, green
- Select text → click "Personal highlight" → choose color
- Only visible to the highlighter, not collaborators

## Feature 5: Document Statistics Dashboard
Aggregate view of all documents with stats.
- New page: `/stats`
- Shows: total docs, total words, docs per folder, most active docs, collaborator leaderboard
- Charts: docs created per week, word count distribution
- Simple HTML/CSS charts (no charting library needed)

## Feature 6: Scheduled Reminders
Set a reminder to revisit a document at a specific time.
- New Prisma model: Reminder (id, documentId, userId, remindAt, message, dismissed)
- API: GET/POST/DELETE /api/reminders
- UI: "Remind me" button in TopBar dropdown
- On document list page, show reminder badge on docs with upcoming reminders
- Check reminders on page load (compare remindAt with now)

## Feature 7: Revision Requests
Request specific changes on text ranges (like GitHub code review).
- Similar to comments but with a "requested change" semantic
- New status: "change_requested" on suggestion-like objects
- Assignee field (who should make the change)
- Shows in comment sidebar with a distinct "Changes Requested" style
- Can be resolved when the change is made

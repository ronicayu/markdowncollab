# Comment Filter & Content-Deleted Detection

**Date:** 2026-04-05
**Status:** Approved

## Overview

Two related improvements to the comment sidebar:

1. A dropdown filter so users can switch between Open / Resolved / All comments. Default is Open.
2. Visual detection of "content deleted" — when the text a comment refers to has been deleted from the document, the comment card shows a badge rather than silently hiding or auto-resolving.

## Requirements

- Default view shows only unresolved comments (no change to current default experience).
- Users can switch to Resolved or All via a `<select>` dropdown in the sidebar header.
- A comment whose annotated text has been deleted is shown in the Open filter with a "Content deleted" badge. The Resolve button remains so the user can dismiss it manually.
- Resolved comments are visually muted. No Resolve button. Green checkmark badge.
- The "+ Comment" button is hidden when the Resolved filter is active (no point adding a comment in that view).
- No schema or Yjs store changes — "content deleted" is a derived UI state only.

## Architecture

### Active comment ID tracking (`doc/[id]/page.tsx`)

Add a `activeCommentIds` state (`Set<string>`). Whenever the editor's document changes, walk all nodes and collect every `commentId` attribute from `commentMark` marks. This set is passed down to `CommentSidebar`.

```
editor.on("update", () => {
  const ids = new Set<string>();
  editor.state.doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === "commentMark") ids.add(mark.attrs.commentId);
    });
  });
  setActiveCommentIds(ids);
});
```

A comment is **content-deleted** when: `!comment.resolved && !activeCommentIds.has(comment.id)`.

### CommentSidebar

**New prop:** `activeCommentIds: Set<string>`

**New local state:** `filter: "open" | "resolved" | "all"` — default `"open"`.

**Filtered list logic:**
- `"open"` → `comments.filter(c => !c.resolved)`
- `"resolved"` → `comments.filter(c => c.resolved)`
- `"all"` → all comments

**Header layout:** `[Comments heading] [<select> Open/Resolved/All] [+ Comment button]`

The `<select>` sits between the heading and the button. Styled small (text-xs), amber focus border, no distracting chrome.

The "+ Comment" button is only rendered when `hasSelection && filter !== "resolved"`.

Each `CommentCard` receives `isContentDeleted={!comment.resolved && !activeCommentIds.has(comment.id)}`.

### CommentCard

**Remove** the early `return null` guard for resolved comments — visibility is now controlled by the sidebar filter.

**New prop:** `isContentDeleted: boolean`

**Rendering logic:**

| State | Treatment |
|---|---|
| Active / open | Existing amber ring style, Resolve button |
| Content deleted | Muted card, amber "Content deleted" badge below text, Resolve button still shown |
| Resolved | Muted card, grey text, green checkmark badge, no Resolve button |

## Files Changed

| File | Change |
|---|---|
| `src/app/doc/[id]/page.tsx` | Add `activeCommentIds` state + editor `update` listener; pass to `CommentSidebar` |
| `src/components/CommentSidebar.tsx` | Add `filter` state + `<select>` UI; accept + forward `activeCommentIds`; filter logic |
| `src/components/CommentCard.tsx` | Remove resolved guard; add `isContentDeleted` prop; conditional rendering for all three states |

## Out of Scope

- Persisting "content deleted" state to Yjs.
- A separate filter option for content-deleted comments.
- Auto-resolving comments when their content is deleted.
- Mobile bottom sheet changes (resolved/deleted comments are a secondary concern on mobile).

# Find & Replace

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Table-stakes editor feature

## Problem

No way to search within a document or replace text. Users expect Cmd+F to work in any editor. Currently, browser's native find works but can't replace, doesn't integrate with the editor, and doesn't handle Tiptap's DOM structure well.

## Design

### Approach

Implement a custom Tiptap extension wrapping a ProseMirror plugin. Tiptap v3 has no official search-and-replace extension, so we build a lightweight custom one that provides decorations for matches and commands for find/replace operations.

### Implementation

**New extension: `src/extensions/search-replace.ts`**

ProseMirror plugin that:
1. Maintains search state: query, case sensitivity, current match index
2. Creates decorations for all matches (yellow highlight)
3. Highlights current match differently (orange)
4. Provides commands: `findNext`, `findPrevious`, `replaceCurrent`, `replaceAll`

**Search logic:**
- Walk the ProseMirror document's text content
- Find all matches for the query string
- Map text offsets back to ProseMirror positions
- Create inline decorations at those positions

**Replace logic:**
- `replaceCurrent`: Replace text at current match position via transaction
- `replaceAll`: Replace all matches in a single transaction (atomic)
- Both work with Yjs — Tiptap transactions are synced via collaboration extension

### UI

**Search Bar:**
- Floating bar below the toolbar, similar to VS Code's find widget
- Triggered by Cmd+F (Mac) / Ctrl+F (Windows)
- Input field with match count ("3 of 12")
- Up/down arrows to navigate matches
- Case sensitivity toggle (Aa button)
- Close button (Escape)

**Replace Bar:**
- Expands below search bar when Cmd+H / Ctrl+H pressed
- Replace input field
- "Replace" button (current match) and "Replace All" button
- Only visible to users with editor role

**Keyboard Shortcuts:**
- `Cmd+F` / `Ctrl+F`: Open search
- `Cmd+H` / `Ctrl+H`: Open search + replace
- `Enter` / `Cmd+G`: Find next
- `Shift+Enter` / `Cmd+Shift+G`: Find previous
- `Escape`: Close search bar

### Collaboration Considerations

- Search is local only — each user has their own search state
- Replace operations go through Tiptap's transaction system → synced via Yjs
- Decorations are local (ProseMirror plugin state, not Yjs awareness)
- If another user edits text that contains a match, matches re-compute on next keystroke

### Integration with Existing Code

- Add extension to Editor.tsx's extensions array
- Add search bar component above editor content area
- Register keyboard shortcuts via Tiptap's `addKeyboardShortcuts()`
- Search state managed via React state, not ProseMirror plugin state (simpler)

## Team Debate Notes

**SWE 2 challenged:** "Should we use regex search?"
**SWE 1 response:** "Regex is power-user territory. Plain text + case sensitivity covers 95% of use cases. Add regex later if requested."
**Consensus:** Plain text search with case sensitivity toggle. No regex in v1.

**QE challenged:** "How does replace interact with suggestions and comments?"
**SWE 1 response:** "Replace modifies the document text, which may invalidate suggestion anchors (they'll go stale via contentHash mismatch). Comments use RelativePosition which survives text changes. This is acceptable — the same thing happens with manual edits."
**Consensus:** No special handling needed. Existing stale detection handles it.

## Testing Strategy

- Unit test search logic: multiple matches, case sensitivity, no matches
- Unit test replace: single replace, replace all, empty document
- Test match count display accuracy
- Test keyboard shortcut registration
- Manual test with collaborative editing (search while another user types)

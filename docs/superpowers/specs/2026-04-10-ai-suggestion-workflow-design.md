# AI Suggestion Workflow — Tracked Changes

**Date:** 2026-04-10
**Status:** Draft
**Priority:** P0 — Core product differentiator

## Problem

AI actions (rewrite, expand, summarize) currently **directly replace** selected text or show an ephemeral accept/reject preview visible only to the requesting user. This is "AI-as-tool" behavior. The product vision is "AI-as-collaborator" — AI suggestions should be:

1. Visible to all connected collaborators (via Yjs CRDT)
2. Reviewable with inline tracked-changes styling
3. Persistently accept/reject-able from the suggestion sidebar
4. Attributed to the AI agent with rationale

## Existing Infrastructure (already built)

| Component | Status | Location |
|-----------|--------|----------|
| `SuggestionMark` extension | Done | `src/extensions/suggestion-mark.ts` |
| `suggestion-store.ts` (Yjs-backed) | Done | `src/lib/suggestion-store.ts` |
| `SuggestionCard` (accept/reject UI) | Done | `src/components/SuggestionCard.tsx` |
| `Suggestion` type (with status, relPos, rationale) | Done | `src/types/index.ts` |
| WS server suggestion observer (notifications) | Done | `server/combined-server.mjs` L556-600 |
| CommentSidebar (renders suggestions) | Done | `src/components/CommentSidebar.tsx` |
| Agent API routes (rewrite, expand, summarize, grammar) | Done | `src/app/api/agent/*/route.ts` |

**Gap is wiring, not primitives.**

## Design

### Phase 1: Wire AI actions to suggestion system (1-2 sessions)

#### A. Modify `EditorStatusBar` AI actions

Current: `Rewrite` → fetch `/api/agent/rewrite` → `setRewritePreview()` → accept = `editor.chain().deleteRange().insertContentAt()`

New: `Rewrite` → fetch `/api/agent/rewrite` → **create Suggestion via `addSuggestion(ydoc, ...)`** → apply `SuggestionMark` to original text (type="delete") + insert new text with mark (type="add")

```typescript
// Pseudocode for the new flow
const suggestion: Suggestion = {
  id: crypto.randomUUID(),
  documentId,
  authorName: "AI Assistant",
  authorType: "agent",
  originalText: selectedText,
  suggestedText: rewritten,
  rationale: `Rewrite (${style}): ${selectedText.slice(0, 50)}...`,
  status: "pending",
  startRelPos: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(fragment, from)),
  endRelPos: Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(fragment, to)),
  contentHash: hashText(selectedText),
  createdAt: new Date().toISOString(),
  resolvedAt: null,
};
addSuggestion(ydoc, suggestion);
// Apply visual marks in editor
editor.chain()
  .setTextSelection({ from, to })
  .setSuggestionMark({ suggestionId: suggestion.id, type: "delete" })
  .insertContentAt(to, rewritten)  // new text after original
  .setSuggestionMark({ suggestionId: suggestion.id, type: "add" })
  .run();
```

#### B. Accept suggestion handler

When user clicks "Accept" on SuggestionCard:
1. Remove original text (marked "delete")
2. Unmark new text (remove "add" mark, keep text)
3. Update suggestion status to "accepted" in Yjs map
4. WS server observer fires notification to suggestion author

#### C. Reject suggestion handler

When user clicks "Reject" on SuggestionCard:
1. Remove new text (marked "add")
2. Unmark original text (remove "delete" mark, keep text)
3. Update suggestion status to "rejected" in Yjs map

#### D. Same flow for Expand + Summarize

- **Expand**: originalText = selection, suggestedText = expanded version, type = "add" only (no deletion)
- **Summarize**: originalText = selection, suggestedText = summary, type = both add + delete

### Phase 2: Agent autonomous suggestions (future)

- Background agent watches document edits via WS
- Periodically suggests improvements (grammar, clarity, structure)
- Creates suggestions without user triggering
- Rate-limited: max 3 autonomous suggestions per 10 minutes per document

### Phase 3: Cross-doc suggestions (future)

- Agent suggests links between documents
- Agent suggests moving sections to other docs
- Agent suggests merging duplicate content

## Files to modify

| File | Change |
|------|--------|
| `src/components/EditorStatusBar.tsx` | Wire AI actions to create Suggestions instead of direct replace |
| `src/components/CommentSidebar.tsx` | Ensure accept/reject handlers properly modify editor content |
| `src/app/doc/[id]/page.tsx` | Pass ydoc to EditorStatusBar for suggestion creation |
| `src/lib/suggestion-store.ts` | Add `acceptSuggestion()` and `rejectSuggestion()` helpers |

## Non-goals

- Multi-cursor suggestion resolution (one user at a time is fine)
- Suggestion conflict resolution (if text changes under a pending suggestion, mark as "stale" — already supported by status field)
- Suggestion threading/discussion (use comments for that)

## Success criteria

1. AI rewrite creates a visible tracked change for all collaborators
2. Any editor-role user can accept or reject the suggestion
3. Accepted suggestions cleanly integrate into document text
4. Rejected suggestions cleanly restore original text
5. Suggestion author (AI) gets notified on accept/reject (already wired in WS server)

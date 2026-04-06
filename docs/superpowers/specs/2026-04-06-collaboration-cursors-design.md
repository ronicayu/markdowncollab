# Collaboration Cursors

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P0 — Core collab feature is broken

## Problem

Real-time collaboration cursors are disabled. The `@tiptap/extension-collaboration-cursor` is imported but not properly integrated due to a `y-prosemirror` compatibility issue. Users can't see where others are editing, which defeats the purpose of real-time collaboration.

## Design

### Root Cause

The editor uses `@tiptap/extension-collaboration` (v3) with `@tiptap/y-tiptap` binding, but `collaboration-cursor` depends on `y-prosemirror` which has version conflicts with the new Tiptap v3 binding. The cursor plugin needs to use the same Yjs awareness instance.

### Approach

Use `@tiptap/extension-collaboration-cursor` with the awareness instance from the WebSocket provider. The key is passing the correct `provider.awareness` to the extension and ensuring the user info (name, color) is set on the awareness state.

### Implementation

In `src/app/doc/[id]/page.tsx`, when creating the WebSocket provider:
1. The provider already has an awareness instance
2. Set local awareness state with user name and color
3. Pass awareness to the collaboration-cursor extension

In `src/components/Editor.tsx`:
- Add `CollaborationCursor` extension configured with:
  - `provider` (the WebSocket provider for awareness)
  - `user: { name, color }` from session or anonymous identity
- Cursor renders as a colored caret with name label

### Color Assignment

Assign a consistent color per user based on a hash of their name:
```typescript
const CURSOR_COLORS = [
  '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#22c55e',
  '#ec4899', '#f59e0b', '#6366f1', '#14b8a6', '#e11d48'
];
function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
```

### Cursor Styling

Add to globals.css:
```css
.collaboration-cursor__caret {
  position: relative;
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
}
.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px 3px 3px 0;
  color: white;
  white-space: nowrap;
  user-select: none;
}
```

### Awareness Updates

The WebSocket server already handles awareness protocol messages (message type 1). No server-side changes needed. The client just needs to:
1. Set local state: `provider.awareness.setLocalStateField('user', { name, color })`
2. The collaboration-cursor extension renders remote awareness states as carets

### Anonymous Users

For users not signed in, generate a random animal name (e.g., "Anonymous Fox") and assign a color. This ensures cursor visibility even without auth.

## Team Debate Notes

**SWE 1 challenged:** "What if y-prosemirror still has the version conflict?"
**SWE 2 response:** "The collaboration-cursor extension in Tiptap v3 uses @tiptap/y-tiptap internally, not y-prosemirror directly. We should test this first — the conflict may be resolved in the current version."
**Consensus:** Try the standard integration first. If it fails, implement a custom cursor plugin using ProseMirror decorations driven by awareness state.

## Testing Strategy

- Integration test: two WebSocket clients, verify awareness state sync
- E2E test: two browser contexts, verify cursor labels appear
- Test color assignment consistency (same name = same color)

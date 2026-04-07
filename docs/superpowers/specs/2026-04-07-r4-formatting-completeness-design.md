# Round 4: Formatting Completeness

**Date:** 2026-04-07
**Status:** Approved (internal team consensus)
**Priority:** P0 — Required for daily-driver usage

## Overview

Seven features to close every formatting gap that makes users think "this is incomplete." After R4, the editor should have full formatting parity with Google Docs for text editing.

---

## Feature 1: Hyperlinks (Cmd+K)

### Problem
No way to insert links. Users can't share URLs, reference Jira tickets, or link to external docs.

### Design
Use `@tiptap/extension-link`. Add a link insertion dialog triggered by Cmd+K or toolbar button.

**Install:** `npm install @tiptap/extension-link`

**Extension config:**
```typescript
Link.configure({
  openOnClick: false,      // Don't navigate on click in editor
  HTMLAttributes: { class: 'editor-link' },
  autolink: true,          // Auto-detect URLs on paste/type
  linkOnPaste: true,       // Convert pasted URLs to links
})
```

**UI — Link Dialog:**
- Triggered by Cmd+K or toolbar link button
- Two inputs: URL and Display Text (pre-filled with selection)
- "Apply" and "Remove Link" buttons
- Small modal positioned near the cursor

**Slash command:** Add `/link` to open the dialog.

**Toolbar:** Add link icon button (chain icon) in the formatting section.

**Markdown export:** Links already export as `[text](url)` via tiptap-markdown.

---

## Feature 2: Undo/Redo with Yjs

### Problem
`undoRedo: false` in StarterKit disables Cmd+Z/Cmd+Shift+Z. Users expect undo to work.

### Design
Use Yjs's built-in `Y.UndoManager` which tracks local changes only — undoing your edits doesn't undo collaborator edits.

**Remove:** `undoRedo: false` from StarterKit config.
**Add:** Tiptap's built-in History extension is incompatible with Yjs. Instead, the `@tiptap/extension-collaboration` already supports undo when configured with the Yjs undo manager.

Actually, Tiptap v3's Collaboration extension works with `@tiptap/extension-history` replacement. The approach:
1. Remove `undoRedo: false` — let StarterKit include its history
2. BUT StarterKit's history conflicts with Yjs. Instead, use the `y-prosemirror` `undo` and `redo` functions.
3. Register keyboard shortcuts Mod-z → yUndo, Mod-Shift-z → yRedo

**Implementation:**
- Import `yUndoPlugin, undo as yUndo, redo as yRedo` from `y-prosemirror`
- Create a simple Tiptap extension that adds the yUndo plugin and maps Mod-z/Mod-Shift-z
- Keep `undoRedo: false` in StarterKit (to prevent conflict)
- Add Undo/Redo buttons to toolbar

---

## Feature 3: Underline

### Problem
No underline formatting. Users expect Cmd+U to work.

### Design
Use `@tiptap/extension-underline`.

**Install:** `npm install @tiptap/extension-underline`

Add to Editor.tsx extensions. Add "U" button to Toolbar between Italic and Strikethrough.

---

## Feature 4: Text Highlight

### Problem
No way to highlight text with a background color for emphasis.

### Design
Use `@tiptap/extension-highlight`.

**Install:** `npm install @tiptap/extension-highlight`

Configure with `multicolor: false` for v1 (single yellow highlight color). Add highlight toggle button to Toolbar (marker/pen icon). Keyboard shortcut: Cmd+Shift+H.

---

## Feature 5: Text Alignment

### Problem
All text is left-aligned. Can't center headings or justify paragraphs.

### Design
Use `@tiptap/extension-text-align`.

**Install:** `npm install @tiptap/extension-text-align`

Configure with `types: ['heading', 'paragraph']`. Add alignment buttons (left/center/right) to Toolbar. Keyboard shortcuts: Cmd+Shift+L/E/R.

---

## Feature 6: Code Block Language Selector

### Problem
Code blocks exist but users can't select the programming language via UI. Must know markdown syntax.

### Design
When the cursor is inside a code block, show a language dropdown at the top-right corner of the block. Selecting a language updates the code block's `language` attribute.

**Languages:** A curated list: JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, Ruby, PHP, SQL, HTML, CSS, JSON, YAML, Bash, Markdown, Plain Text.

**Implementation:** Modify the code block node view (or add a new custom extension) to render a `<select>` dropdown when the block is focused/active.

---

## Feature 7: Indent/Outdent Toolbar Buttons

### Problem
Nested lists need visible indent/outdent controls. Users don't know about Tab/Shift+Tab.

### Design
Add two buttons to Toolbar:
- Indent (right arrow icon) → `editor.chain().focus().sinkListItem('listItem').run()`
- Outdent (left arrow icon) → `editor.chain().focus().liftListItem('listItem').run()`

Only enabled when cursor is inside a list item.

---

## Testing Strategy
- Unit test link dialog rendering and URL validation
- Unit test undo/redo plugin registration
- Test all new extensions register without errors
- E2E: insert link, verify it renders and exports correctly

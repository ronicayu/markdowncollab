# Table Support

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P0 — Required for structured content

## Problem

No way to create tables. Teams can't do sprint planning, requirements docs, comparison matrices, or data documentation without tables. This is a top-3 missing feature for daily team use.

## Design

### Approach

Use Tiptap's official table extension package (`@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`). These are mature, well-tested extensions that integrate with Yjs collaboration.

### Dependencies

```bash
npm install @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

### Editor Integration

Add all four table extensions to Editor.tsx's extensions array. Configure with:
- `resizable: false` (simplicity for v1)
- `HTMLAttributes: { class: 'editor-table' }`

### Slash Command

Add `/table` to SlashCommandMenu.tsx:
- Label: "Table"
- Description: "Insert a 3x3 table"
- Action: `editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()`

### Toolbar Button

Add table icon button to Toolbar.tsx after the horizontal rule button. Inserts a default 3x3 table with header row.

### Table Styling

Add to globals.css:
```css
.editor-table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
}
.editor-table td, .editor-table th {
  border: 1px solid #d4a574;
  padding: 0.5rem;
  min-width: 80px;
  vertical-align: top;
}
.editor-table th {
  background-color: rgba(180, 120, 60, 0.1);
  font-weight: 600;
}
.editor-table .selectedCell {
  background-color: rgba(180, 120, 60, 0.15);
}
```

### Context Menu (Right-click on table)

Skip for v1. Users can add/remove rows and columns via keyboard (Tab to add column, Enter to add row) or through the Tiptap table commands programmatically. A table toolbar will be added if users request it.

### Markdown Export

Update `export-markdown.ts` to handle table nodes:
- Convert table to pipe-delimited markdown format
- Header row gets separator line (`| --- | --- |`)
- Cell content exported as inline markdown

### Collaboration

Tables work with Yjs out of the box via Tiptap's collaboration extension. Each cell is a separate node in the Yjs tree, so concurrent edits to different cells don't conflict.

## Team Debate Notes

**SWE 2 challenged:** "Do we need resizable columns?"
**SWE 1 response:** "Resizable adds drag handles, CSS, and edge cases. Skip for v1. Auto-width is fine."
**Consensus:** No resize. Add later if requested.

## Testing Strategy

- Unit test table insertion command
- Test markdown export of tables (header row, data rows, inline formatting in cells)
- E2E test: create table via slash command, type in cells, verify content

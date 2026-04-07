# Round 7: Final Round

**Date:** 2026-04-07
**Status:** Approved (internal team consensus)
**Priority:** Final polish before declaring feature-complete

## Feature 1: Document Folders

Hierarchical document organization. Users can create folders, move documents into them, and navigate the folder tree.

**Data Model:**
```prisma
model Folder {
  id        String   @id @default(uuid())
  name      String
  parentId  String?
  ownerId   String
  createdAt DateTime @default(now())
  @@index([ownerId, parentId])
}
```

Add `folderId String?` to Document model.

**API:**
- `GET /api/folders` — list user's folders (tree structure)
- `POST /api/folders` — create folder
- `PUT /api/folders/[id]` — rename folder
- `DELETE /api/folders/[id]` — delete folder (moves docs to parent/root)
- `PUT /api/documents/[id]` — update folderId (move to folder)

**UI:**
- Folder tree in sidebar (collapsible, nested)
- "New Folder" button
- Drag documents into folders
- Breadcrumb navigation in document list header
- "All Documents" shows everything; clicking a folder filters to its contents

## Feature 2: Emoji Picker

Lightweight emoji picker triggered by `:` in the editor.

**Implementation:**
- Install `emoji-picker-react` or build a simple one
- When user types `:` followed by text, show emoji suggestions
- Use Tiptap's suggestion utility (same pattern as slash commands)
- Common emoji shortcodes: `:smile:`, `:thumbsup:`, `:fire:`, etc.
- Alternative: toolbar button that opens a picker popover

Simpler approach chosen: Just use the toolbar. Add an emoji button that opens a small grid of common emojis. Inserting an emoji inserts the unicode character directly. No shortcode parsing needed.

## Feature 3: Table of Contents Block

A special block that renders an auto-generated table of contents from the document's headings.

**Implementation:**
- New slash command: `/toc`
- Renders as a `<div class="toc-block">` with links to each heading
- Updates live as headings change
- Clicking a TOC entry scrolls to that heading
- Similar to the outline sidebar but inline in the document

## Feature 4: Word Count Goals

Add optional word count targets to documents for writers working on longer content.

**Implementation:**
- Click the word count in the footer to set a goal
- Shows progress bar: "150 / 500 words (30%)"
- Goal stored in localStorage per document
- Visual indicator: gray -> amber -> green as you approach/reach the goal

## Feature 5: Update E2E Tests

Update the Playwright E2E tests to cover features from R2-R6:
- Table creation and editing
- Image upload
- Template creation
- Dark mode toggle
- Task list checkbox toggle
- Slash command menu (full list)

## Feature 6: Footnotes

Academic-style footnotes using Tiptap's footnote support or a custom extension.

**Implementation:**
- Footnote marker in text: superscript number
- Footnote content at bottom of document
- Slash command: `/footnote`
- Export as markdown footnote syntax: `[^1]` and `[^1]: content`

## Feature 7: Final Integration QA

Run the full QA suite on the live app. Browse every page, test every feature, document any regressions. Fix anything found.

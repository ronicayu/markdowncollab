# Round 11: Knowledge Base Features

**Date:** 2026-04-07
**Status:** Approved

## Feature 1: Wiki-Style Cross-Doc Links

Type `[[` to search and link to other documents. Renders as a styled internal link.

**Implementation:**
- New Tiptap extension using suggestion plugin (like slash commands)
- Trigger: `[[` → opens autocomplete with document titles
- On select: inserts a custom `docLink` inline node with documentId and title
- Renders as styled link (different from external links — e.g., dashed underline)
- Click navigates to that document
- Export as `[[Document Title]]` in markdown

## Feature 2: AI Chat Sidebar

Conversational AI panel where you can ask questions about your document.

**Implementation:**
- New: `src/components/AIChatSidebar.tsx`
- Toggle from TopBar (chat bubble icon next to Invite Agent)
- Chat interface: message history, text input, send button
- Sends document content + user message to Anthropic API
- API: `POST /api/agent/chat` — streaming response
- Messages stored in component state (not persisted — ephemeral per session)
- Context: passes current document markdown as system context

## Feature 3: Batch Export (ZIP)

Download multiple documents as a ZIP file.

**Implementation:**
- Install: `npm install archiver` (or use JSZip on client side)
- New: `GET /api/documents/export?ids=id1,id2,id3&format=md`
- Server reads each doc's markdown, creates ZIP, returns as download
- UI: Bulk select documents on list page → "Export selected" button
- Also: "Export all" option in sidebar
- Use `archiver` for server-side ZIP creation

## Feature 4: Table Sorting

Click a table column header to sort rows by that column.

**Implementation:**
- Extend the table rendering in Editor
- Add click handler on `<th>` cells that sorts `<tr>` rows
- Sort toggle: none → ascending → descending → none
- Visual indicator: ▲/▼ arrows on sorted column
- Sort is a UI-only operation (reorders DOM, creates Tiptap transaction to move rows)

## Feature 5: Document Approval Workflow

Documents have a status: Draft → In Review → Approved.

**Implementation:**
- Add `status String @default("draft")` to Document model (values: "draft", "in_review", "approved")
- Add `approvedBy String?` and `approvedAt DateTime?`
- Status badge in TopBar and document list
- "Submit for review" / "Approve" / "Request changes" buttons for owner
- Status change creates activity log entry
- Approved docs show a green badge

## Feature 6: Backlinks

Show which other documents link TO this document (via wiki-links).

**Implementation:**
- When a wiki-link `[[DocName]]` is saved, store the link relationship
- New: `GET /api/documents/[id]/backlinks` — returns documents that contain a `[[` link to this doc
- Scan markdown files for `[[DocTitle]]` patterns matching this doc's title
- Display in a "Linked from" section in the outline sidebar or a separate panel

## Feature 7: Advanced Search Filters

Enhance the existing search with filters.

**Implementation:**
- Modify `GET /api/documents/search` to accept: `tag`, `folderId`, `dateFrom`, `dateTo`, `owner`
- UI: expandable filter row below search input
- Dropdowns for tag, folder, date range picker
- Filters compose with text search

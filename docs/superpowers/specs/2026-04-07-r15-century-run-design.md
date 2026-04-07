# Round 15: Century Run

**Date:** 2026-04-07

## Feature 1: Document Locking
Temporarily lock a document to prevent edits (e.g., during review).
- Add `lockedBy String?` and `lockedAt DateTime?` to Document model
- Lock/unlock API: PUT /api/documents/[id]/lock
- When locked: editor becomes read-only for everyone except the locker
- Lock indicator in TopBar: "Locked by Alice" with unlock button (owner/locker only)
- Auto-unlock after 1 hour (or configurable)

## Feature 2: AI Summary Generation
Auto-generate a short summary/abstract of the document.
- New API: POST /api/documents/[id]/summarize
- Sends document content to Anthropic API with "summarize in 2-3 sentences" prompt
- Stores summary in document metadata or returns inline
- Shows summary in document list as hover tooltip
- "Generate summary" button in TopBar

## Feature 3: Keyboard Macros
Record and replay sequences of editor actions.
- Record button in toolbar: start/stop recording
- During recording: capture all Tiptap commands executed
- Save macro with a name to localStorage
- Replay: execute captured commands in sequence
- Simple implementation: record keystrokes, replay them

## Feature 4: Document Expiration
Auto-archive documents after a configurable period of inactivity.
- Add `expiresAt DateTime?` to Document model
- Set expiration from document settings (TopBar dropdown): 7d, 30d, 90d, never
- Expired docs move to trash automatically
- Check on document list load: if updatedAt + expirationPeriod < now, soft-delete
- Show expiration badge on doc list rows

## Feature 5: Multi-Document Search & Replace
Find and replace text across all documents at once.
- New page: /search-replace
- Search input + replace input
- Searches all markdown files, shows matches with context
- "Replace all in document" or "Replace all everywhere" buttons
- Preview before applying

## Feature 6: Recent Documents Widget
Quick-access floating panel of last 5 opened documents.
- Track recently opened docs in localStorage
- Small widget in bottom-right corner (or sidebar)
- Shows last 5 doc titles, click to navigate
- Collapses to a small icon when not needed

## Feature 7: Document Health Score
Readability and completeness metrics for a document.
- Flesch reading ease score
- Average sentence length
- Completeness: % of template sections filled (for template-based docs)
- Quality indicators: has headings? has links? appropriate length?
- Show as a small badge/score in TopBar or footer
- Color: red (<50), amber (50-75), green (>75)

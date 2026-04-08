# Feature Backlog — Markdown Collab R15

**Date:** 2026-04-08
**Status:** Approved (team consensus)
**Scope:** 19 items across 3 priority tiers

---

## Backlog Items

### P0 — Bug Fixes & Critical Gaps

#### COLLAB-001: Wire @Mention Notifications
**Story:** As a collaborator, when someone @mentions me in a comment, I receive an in-app notification so I don't miss it.
**Acceptance Criteria:**
- [ ] Parsing `@username` from comment text creates a Notification record (type: "mention")
- [ ] Notification includes actor name, document title, and comment excerpt
- [ ] Notification bell badge increments
- [ ] Clicking notification navigates to document and scrolls to comment
**Technical Notes:** Comment save flows through both client-side API calls and Yjs Y.Map("comments") observers. Hook into the POST /api/documents/[id]/comments endpoint to parse mentions and create Notification rows.
**Test Plan:** Create comment with @mention → verify notification created → verify badge count → verify click-through navigation
**UAT:** User A mentions User B in comment → User B sees notification → clicks through to comment

#### COLLAB-002: Debounce Grammar Check API
**Story:** As an editor, grammar checking should not hammer the API on every keystroke, causing rate limit errors.
**Acceptance Criteria:**
- [ ] Grammar check triggers 2 seconds after typing stops (debounce)
- [ ] Unchanged paragraphs are not re-checked (cache by content hash)
- [ ] No rate limit errors during normal typing
- [ ] Grammar underlines still appear within 3 seconds of pause
**Technical Notes:** Modify GrammarCheck extension's `onUpdate` handler. Add paragraph-level content hashing. Cache results in a Map<hash, GrammarResult[]>.
**Test Plan:** Type continuously for 10 seconds → verify only 1 API call after pause → verify cached paragraphs skip API → verify underlines appear
**UAT:** Type a paragraph with errors → pause → grammar highlights appear without errors in console

#### COLLAB-003: WebSocket Room Cleanup
**Story:** As an operator, idle WebSocket rooms should be cleaned up to prevent memory leaks in long-running servers.
**Acceptance Criteria:**
- [ ] Rooms with no connections for 30 minutes are destroyed
- [ ] Yjs state is persisted to SQLite before room destruction
- [ ] Cleanup runs on 5-minute interval
- [ ] Active rooms are never affected
- [ ] Server logs room cleanup events
**Technical Notes:** In combined-server.mjs, track `lastActivity` timestamp per room. Add setInterval sweep. Call `doc.destroy()` after persistence.
**Test Plan:** Create room → disconnect all clients → wait 30 min (or mock timer) → verify room destroyed → reconnect → verify state restored from SQLite
**UAT:** Operator monitors server memory over 24h with intermittent usage → no memory growth from abandoned rooms

#### COLLAB-004: Pagination on Search & Notifications
**Story:** As a user with many documents/notifications, results should paginate instead of returning everything.
**Acceptance Criteria:**
- [ ] `/api/documents/search` accepts `?page=1&limit=20`, returns `{ items, total, page, pageSize }`
- [ ] `/api/notifications` accepts same pagination params
- [ ] Client components show "Load more" or page controls
- [ ] Default limit is 20, max is 100
**Technical Notes:** Add Prisma `skip`/`take` to queries. Update response shape. Add pagination component to NotificationPanel and search results.
**Test Plan:** Seed 50 documents → search → verify first page has 20 → load next page → verify remaining → verify total count
**UAT:** User with 50+ notifications scrolls through pages without performance issues

#### COLLAB-005: Version Snapshot Pruning Warning
**Story:** As an author, I should be warned before auto-snapshots are deleted so I can preserve important versions.
**Acceptance Criteria:**
- [ ] Toast notification at 45 snapshots: "Approaching version limit (45/50)"
- [ ] At 50, before deleting oldest: toast with "Oldest version removed to make room"
- [ ] "Download all versions" button in version history panel
- [ ] Per-document configurable limit (default 50, stored in Document model)
**Technical Notes:** Check snapshot count in the auto-snapshot creation flow (server-side). Add `maxVersions` column to Document. Bulk export creates a ZIP of snapshot metadata + content.
**Test Plan:** Create 46 auto-snapshots → verify warning toast → create 51st → verify oldest deleted with notification → test download all
**UAT:** User sees warning approaching limit → can download versions → understands what happened when old version removed

#### COLLAB-006: Bulk Document Operations
**Story:** As a user managing many documents, I can select multiple documents and perform batch actions.
**Acceptance Criteria:**
- [ ] Checkbox column on dashboard document list
- [ ] Floating action bar on selection: Delete, Move to Folder, Add Tag, Share, Export
- [ ] "Select all" checkbox in header
- [ ] Batch API endpoints: POST `/api/documents/bulk/{action}`
- [ ] Confirmation dialog for destructive actions (delete)
- [ ] Selection persists through pagination
**Technical Notes:** Add selection state to dashboard. Create batch API routes that accept `{ documentIds: string[] }`. Reuse existing single-document logic in a transaction.
**Test Plan:** Select 5 docs → bulk delete → verify all soft-deleted → select 3 docs → bulk tag → verify tags applied → select all → bulk move to folder
**UAT:** User selects multiple docs, moves to folder, tags them, exports batch — all in one flow

#### COLLAB-007: Mobile Sidebar Collapse
**Story:** As a mobile user, sidebars should auto-collapse and be accessible via swipe gestures.
**Acceptance Criteria:**
- [ ] Below 768px: all sidebars auto-collapse
- [ ] Swipe right opens left sidebar (outline), swipe left opens right sidebar (comments/AI)
- [ ] Tap overlay closes sidebar
- [ ] Toolbar wraps into scrollable row on mobile
- [ ] No horizontal scroll on any mobile view
**Technical Notes:** Add `useMediaQuery(768)` hook. Wrap sidebars in a responsive container. Add touch event listeners for swipe detection (threshold: 50px horizontal).
**Test Plan:** Resize to 375px → verify sidebars collapsed → swipe right → outline opens → swipe left → comments open → verify no horizontal overflow
**UAT:** User on phone can access all sidebars via swipe, toolbar is usable, no layout breaks

---

### P2 — New Capabilities

#### COLLAB-008: Document Import (MD, DOCX, HTML)
**Story:** As a user, I can import existing documents from Markdown, DOCX, or HTML files to start collaborating on them.
**Acceptance Criteria:**
- [ ] "Import" button on dashboard next to "New Document"
- [ ] Accepts `.md`, `.docx`, `.html` files (drag-and-drop or file picker)
- [ ] Markdown: preserves headings, lists, code blocks, links, images (as URLs)
- [ ] DOCX: preserves text formatting, headings, lists, tables
- [ ] HTML: preserves semantic structure
- [ ] Imported document opens in editor with content populated
- [ ] File size limit: 10MB with clear error message
**Technical Notes:** Use `marked` for MD→HTML, `mammoth` for DOCX→HTML. Then `generateJSON(html, extensions)` from Tiptap to get ProseMirror JSON. Create Yjs doc from JSON. New API route: POST `/api/documents/import`.
**Test Plan:** Import sample .md with all block types → verify fidelity → import .docx with tables → verify → import .html → verify → test 11MB file rejection
**UAT:** User imports their existing meeting notes from Word → edits collaboratively → content looks correct

#### COLLAB-009: Offline Editing with Service Worker
**Story:** As a user on unstable internet, I can continue editing when disconnected and changes sync when I reconnect.
**Acceptance Criteria:**
- [ ] App works offline after first load (Service Worker caches shell)
- [ ] Edits stored in IndexedDB as Yjs updates
- [ ] Persistent "Offline — changes will sync when reconnected" banner
- [ ] On reconnect: Yjs merge protocol syncs IndexedDB updates (conflict-free via CRDT)
- [ ] No data loss in airplane-mode → edit → reconnect flow
- [ ] Offline indicator replaces connection status in top bar
**Technical Notes:** Register SW in `next.config.ts` (use `next-pwa` or manual). IndexedDB provider: use `y-indexeddb` package alongside `y-websocket`. Yjs supports multiple providers simultaneously — IDB for persistence, WS for sync.
**Test Plan:** Load doc → disconnect network → edit 5 paragraphs → reconnect → verify all changes synced → verify second client sees changes → test concurrent offline edits from 2 clients
**UAT:** User on train edits doc through tunnel → comes out → changes appear for collaborators

#### COLLAB-010: Full-Text Document Search
**Story:** As a user, I can search across all document content (not just titles) to find information.
**Acceptance Criteria:**
- [ ] Search bar on dashboard searches document content + titles
- [ ] Results show matching snippet with highlighted search terms
- [ ] Results ranked by relevance (title match > heading match > body match)
- [ ] Index updates within 30 seconds of document save
- [ ] Search handles 1000+ documents without noticeable delay
**Technical Notes:** New `DocumentSearchIndex` model: `{ documentId, plainText, updatedAt }`. Extract plain text from Yjs XML fragment on persistence. Use SQLite FTS5 for full-text search. Update index in WebSocket persistence callback.
**Test Plan:** Seed 100 docs with varied content → search unique phrase → verify found → search common word → verify ranking → edit doc → verify index updated within 30s
**UAT:** User searches for a phrase they remember writing → finds the correct document → clicks through

#### COLLAB-011: Email Notification Digests
**Story:** As a user, I can opt into daily or weekly email digests of my unread notifications.
**Acceptance Criteria:**
- [ ] User preferences page with digest frequency: None, Daily, Weekly
- [ ] Daily digest sent at 9am UTC, weekly on Mondays 9am UTC
- [ ] Email contains: unread notification count, grouped by document, with links
- [ ] Unsubscribe link in email
- [ ] No email sent if zero unread notifications
**Technical Notes:** New `UserPreference` model: `{ userId, digestFrequency, digestEmail }`. Scheduled API route or cron job. Use `nodemailer` with configurable SMTP. HTML email template with inline styles.
**Test Plan:** Set user to daily → create 3 notifications → trigger digest job → verify email sent with 3 items → set to none → trigger → verify no email → test with 0 unread
**UAT:** User enables daily digest → next morning receives summary email → clicks through to document

#### COLLAB-012: Document Permissions Audit Log
**Story:** As a document owner, I can see a history of who was given/removed access and role changes.
**Acceptance Criteria:**
- [ ] "Access History" tab in document share dialog
- [ ] Logs: share_added, share_removed, role_changed with actor, target, timestamp
- [ ] Entries show: "Alice shared with Bob (editor) — 2h ago"
- [ ] Filterable by action type
- [ ] Accessible only to document owner
**Technical Notes:** Extend ActivityLog with new action types. Add logging in share API endpoints (POST/PUT/DELETE `/api/documents/[id]/share`). New API: GET `/api/documents/[id]/access-history`.
**Test Plan:** Share doc with user → verify log entry → change role → verify → remove share → verify → check non-owner cannot access audit log
**UAT:** Owner reviews who has accessed and shared their sensitive document

#### COLLAB-013: Custom Slash Commands (Wire Existing Model)
**Story:** As a power user, my saved CustomCommands appear in the slash menu so I can quickly insert reusable content.
**Acceptance Criteria:**
- [ ] User's CustomCommands appear in slash menu below built-in commands
- [ ] Custom commands show with a "custom" badge
- [ ] Selecting inserts the saved content at cursor
- [ ] "Save as Slash Command" option in snippet creation
- [ ] Custom commands searchable in slash menu
**Technical Notes:** CustomCommand model already exists. Load user's commands via API in SlashCommandMenu component. Insert content using editor.commands.insertContent(). Add save flow in SnippetDialog.
**Test Plan:** Create custom command → open slash menu → search for it → select → verify content inserted → verify appears with badge → create from snippet flow
**UAT:** User saves a frequently-used template block as slash command → uses it across documents

#### COLLAB-014: Shareable Keyboard Macros
**Story:** As a power user, I can save macros and reuse them across documents or share them with collaborators.
**Acceptance Criteria:**
- [ ] Macros persist to database (survive page reload)
- [ ] "My Macros" panel accessible from toolbar
- [ ] Macros can be global (all docs) or document-scoped
- [ ] Document-scoped macros visible to all document collaborators
- [ ] Macro list shows name, step count, last used
**Technical Notes:** New `Macro` model: `{ id, name, steps (JSON), ownerId, documentId (nullable for global), createdAt }`. API routes for CRUD. Load macros in toolbar MacroPanel component.
**Test Plan:** Record macro → save → reload page → verify persisted → set as global → open different doc → verify available → set as doc-scoped → verify collaborator sees it
**UAT:** User records a formatting macro → uses it across multiple documents → shares with team

---

### P3 — Quality of Life

#### COLLAB-015: Document Reading Time Estimate
**Story:** As a reader, I can see estimated reading time so I know the commitment before reading.
**Acceptance Criteria:**
- [ ] Reading time displayed in document metadata panel (format: "X min read")
- [ ] Shown on dashboard document list as subtle label
- [ ] Calculation: word count / 200 wpm, rounded up
- [ ] Updates in real-time as content changes
**Technical Notes:** Calculate from editor word count (already tracked). Display in MetadataPanel and DocumentRow components.
**Test Plan:** Create doc with 400 words → verify "2 min read" → add 200 words → verify updates to "3 min read"
**UAT:** User sees reading time on dashboard and in editor

#### COLLAB-016: Keyboard Shortcut Customization
**Story:** As a user, I can rebind keyboard shortcuts to match my preferences.
**Acceptance Criteria:**
- [ ] "Customize Shortcuts" button in keyboard shortcuts dialog
- [ ] Click a shortcut → press new key combo → saved
- [ ] Stored in UserPreference model
- [ ] "Reset to defaults" button
- [ ] Conflicts detected and warned
**Technical Notes:** New `UserPreference` field: `keyboardOverrides (JSON)`. Load overrides in editor initialization, merge with default keymap. Add edit mode to KeyboardShortcutsDialog.
**Test Plan:** Rebind Cmd+B to Cmd+Shift+B → verify bold uses new shortcut → verify conflict warning if binding to existing shortcut → reset → verify defaults restored
**UAT:** User rebinds shortcuts to match their Vim/Emacs habits

#### COLLAB-017: Document Pinning on Dashboard
**Story:** As a user, I can pin important documents to the top of my dashboard.
**Acceptance Criteria:**
- [ ] Pin/unpin action on document row (pin icon)
- [ ] Pinned documents always appear at top, sorted by pin date
- [ ] Visual indicator (pin icon) on pinned documents
- [ ] Maximum 10 pinned documents
- [ ] Pin state is per-user (not shared)
**Technical Notes:** Add `pinnedAt` nullable DateTime to DocumentStar model (or new DocumentPin model). Sort dashboard: pinned first (by pinnedAt), then rest by updatedAt.
**Test Plan:** Pin 3 docs → verify they appear at top → unpin 1 → verify it moves back → pin 11th → verify error/warning at limit
**UAT:** User pins their active project docs → always finds them at the top

#### COLLAB-018: Stable Collaborative Cursor Colors
**Story:** As a collaborator, each person should have a consistent color across all documents and sessions.
**Acceptance Criteria:**
- [ ] Cursor color derived from userId (deterministic hash → HSL)
- [ ] Same user always has same color in every document
- [ ] Colors are visually distinct (spread across hue wheel)
- [ ] Color shown in collaborator avatars matches cursor color
**Technical Notes:** Replace random color assignment in CollaborationCursor awareness with `hslFromUserId(userId)` function. Hash userId to 0-360 hue, fixed saturation 70%, lightness 45%.
**Test Plan:** User joins 3 different documents → verify same color in all → verify 2 different users have different colors → verify avatar matches cursor
**UAT:** Users always recognize each other by consistent cursor color

#### COLLAB-019: Export Format Memory
**Story:** As a user who always exports to PDF, the export dialog should default to my last-used format.
**Acceptance Criteria:**
- [ ] Last export format stored in localStorage
- [ ] Export dialog opens with last-used format pre-selected
- [ ] Falls back to Markdown if no preference stored
**Technical Notes:** In ExportMenu component, save `localStorage.setItem('preferredExportFormat', format)` on export. Read on mount.
**Test Plan:** Export as PDF → reopen export → verify PDF selected → export as DOCX → reopen → verify DOCX selected → clear localStorage → verify Markdown default
**UAT:** User exports multiple docs as PDF without having to reselect format each time

---

## Team Workflow

| Phase | Role | Action |
|-------|------|--------|
| Triage | PM | Prioritize P0 → P2 → P3, assign to sprints |
| Implement | Staff SWE | Pick up tickets in priority order, submit PRs |
| Code Review | Staff SWE | Review PRs against acceptance criteria and technical notes |
| Test | QE | Implement tests per test plan, verify acceptance criteria |
| Verify | PO | Verify against acceptance criteria and user story |
| UAT | Users | Execute UAT scenario, confirm real-world usability |

## Dependencies
- COLLAB-009 (Offline) depends on COLLAB-003 (Room Cleanup) for clean reconnection
- COLLAB-013 (Custom Slash) depends on existing CustomCommand model (no migration needed)
- COLLAB-011 (Email Digests) requires SMTP configuration (env vars)
- All other items are independent and parallelizable

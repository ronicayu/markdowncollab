# R16 Feature Backlog — Quality & Completeness

**Date:** 2026-04-08
**Status:** Approved (team consensus)
**Scope:** 9 items across 4 priority tiers

---

## R16-001: Accessibility Sweep
**Story:** As a keyboard/screen-reader user, all interactive elements have proper labels and roles.
**Acceptance Criteria:**
- [ ] All icon-only buttons have aria-label
- [ ] Modals have role="dialog" and aria-modal="true"
- [ ] Popovers and dropdowns have aria-expanded
- [ ] Form inputs have aria-required where needed
- [ ] Focus trap in modals
- [ ] Skip-to-content link works
**Scope:** All components in src/components/

## R16-002: Loading & Empty States
**Story:** As a user, I see helpful feedback when content is loading or absent.
**Acceptance Criteria:**
- [ ] Document list shows skeleton loader while fetching
- [ ] Starred tab shows "No starred documents yet" with star icon
- [ ] Shared tab shows "No documents shared with you"
- [ ] Trash tab shows "Trash is empty"
- [ ] Search shows "No results for [query]"
- [ ] Notification panel shows "No notifications"
**Scope:** src/app/page.tsx, NotificationBell.tsx

## R16-003: Component Extraction from page.tsx
**Story:** As a developer, page.tsx is maintainable with focused components.
**Acceptance Criteria:**
- [ ] DocumentRow extracted (~100 lines)
- [ ] BulkActionsBar extracted (~150 lines)
- [ ] SearchBar extracted (~80 lines)
- [ ] FolderTree extracted (~100 lines)
- [ ] page.tsx drops below 1500 lines
- [ ] All existing tests still pass
**Scope:** src/app/page.tsx → src/components/dashboard/

## R16-004: Keyboard Shortcut Customization
**Story:** As a power user, I can rebind keyboard shortcuts.
**Acceptance Criteria:**
- [ ] UserPreference.keyboardOverrides stores custom bindings
- [ ] Editor loads overrides on mount and applies to Tiptap keymaps
- [ ] Conflict detection warns when binding already in use
- [ ] Reset to defaults button restores original bindings
- [ ] Persisted across page reloads
**Scope:** src/lib/keybindings.ts, Editor.tsx, KeyboardShortcutsDialog.tsx

## R16-005: Full-Text Search Index
**Story:** As a user with 1000+ documents, search is fast and ranked.
**Acceptance Criteria:**
- [ ] DocumentSearchIndex model stores plain text content
- [ ] Index updated within 5s of document save (WebSocket persistence callback)
- [ ] Search API queries DB instead of reading files from disk
- [ ] Results include highlighted snippets
- [ ] Performance: <200ms for 1000 documents
**Scope:** prisma/schema.prisma, server/combined-server.mjs, search/route.ts

## R16-006: Input Validation Hardening
**Story:** As an operator, all user inputs are validated to prevent abuse.
**Acceptance Criteria:**
- [ ] Email format validated in share endpoints (regex check)
- [ ] Document title max 500 chars, trimmed
- [ ] API rate limiting: 60 req/min per user on write endpoints
- [ ] File upload size validated server-side (already done for import, extend to images)
- [ ] Request body size limited to 1MB
**Scope:** share/route.ts, documents/route.ts, middleware

## R16-007: Auth Edge Cases
**Story:** As a document owner, access controls are enforced correctly.
**Acceptance Criteria:**
- [ ] Viewers cannot restore versions (403 response)
- [ ] Viewers cannot create/modify shares (403 response)
- [ ] Password-protected docs require password on WebSocket connect
- [ ] Expired documents return 410 Gone
**Scope:** versions/route.ts, share/route.ts, combined-server.mjs

## R16-008: E2E Tests for R15 Features
**Story:** As a QE, all R15 features have automated browser tests.
**Acceptance Criteria:**
- [ ] Document import flow (upload .md, verify content)
- [ ] Bulk select + delete flow
- [ ] Pin/unpin document flow
- [ ] Search with pagination
- [ ] Mobile sidebar collapse (viewport resize)
**Scope:** e2e/

## R16-009: Console Warning Cleanup
**Story:** As a developer, the console is clean with no warnings or unhandled errors.
**Acceptance Criteria:**
- [ ] All useEffect hooks have proper cleanup functions
- [ ] No unhandled promise rejections in components
- [ ] Remove stale console.error calls that should be proper error handling
- [ ] Fix any React strict mode warnings
**Scope:** All components with fetch() calls

# E2E Test Suite

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P0 — Foundation for all future features

## Problem

Only 2 unit test files exist (CommentCard, CommentSidebar). No integration or E2E tests. Every new feature increases risk of regressions. The team can't confidently ship without test coverage on critical paths.

## Design

### Approach

Playwright for E2E tests covering the critical user paths. Vitest for new unit/integration tests on business logic. Focus on the paths that, if broken, would make the app unusable.

### Test Framework Setup

**Playwright:**
- Config at `playwright.config.ts`
- Tests in `e2e/` directory
- Run against local dev server (combined mode on port 3000)
- Single browser (Chromium) for speed; add Firefox/Safari later
- Screenshot on failure for debugging

**Vitest (existing):**
- Already configured
- Add tests in `src/**/__tests__/` alongside source files

### Critical Path E2E Tests

**1. Authentication Flow (`e2e/auth.spec.ts`)**
- Register new account
- Sign in with email/password
- Sign out
- Redirect to sign-in when accessing doc without auth

**2. Document Management (`e2e/documents.spec.ts`)**
- Create new document
- Rename document
- Duplicate document
- Delete document
- Search documents
- Sort documents

**3. Editor Core (`e2e/editor.spec.ts`)**
- Type text and verify content
- Apply formatting (bold, italic, heading)
- Use slash command menu
- Undo/redo

**4. Collaboration (`e2e/collaboration.spec.ts`)**
- Two browser contexts editing same document
- Verify real-time sync (type in one, see in other)
- Collaborator presence (avatar appears)
- Comment creation and display
- Comment reply and resolve

**5. AI Agent (`e2e/agent.spec.ts`)**
- Invite agent (mock Anthropic API)
- Verify suggestions appear
- Accept suggestion
- Reject suggestion

**6. Export (`e2e/export.spec.ts`)**
- Create document with formatting
- Export as markdown
- Verify exported content matches

### New Unit/Integration Tests

**Access control (`src/lib/__tests__/access-control.test.ts`):**
- Test `checkDocumentAccess()` function (added with permissions feature)
- All role combinations: owner, editor, viewer, no access
- Share link token validation

**Templates (`src/lib/__tests__/templates.test.ts`):**
- Verify all templates parse as valid markdown
- Test template variable substitution

**Version history (`src/lib/__tests__/version-history.test.ts`):**
- Snapshot creation and restoration
- Auto-pruning logic

**Notification creation (`src/lib/__tests__/notifications.test.ts`):**
- Test each notification trigger type
- Test recipient resolution

### Test Infrastructure

**Playwright helpers:**
```typescript
// e2e/helpers.ts
async function createTestUser(page) { /* register + sign in */ }
async function createDocument(page, title?) { /* create and navigate */ }
async function getEditorContent(page) { /* extract text from editor */ }
async function waitForSync(page) { /* wait for Yjs sync indicator */ }
```

**Test database:**
- Use separate SQLite database for tests (`test.db`)
- Reset between test suites
- Seed with test users if needed

**API mocking:**
- Mock Anthropic API for agent tests (avoid real API calls + costs)
- Use Playwright's `page.route()` for API interception

### CI Integration

Add to `package.json` scripts:
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:all": "vitest run && playwright test"
}
```

No CI/CD pipeline exists yet — tests run locally for now. CI setup is out of scope.

### Coverage Targets

- E2E: Cover all 6 critical paths listed above
- Unit: Cover all new business logic (access control, templates, versions, notifications)
- No coverage percentage target — focus on critical paths, not metrics

## Team Debate Notes

**SWE 2 challenged:** "Should we test all browsers?"
**QE response:** "Chromium only for v1. Cross-browser bugs are rare for our tech stack (React + Tailwind). Add Firefox when we have CI."
**Consensus:** Chromium only.

**PM challenged:** "Is mocking the Anthropic API sufficient? What about real API integration?"
**SWE 1 response:** "Real API tests are flaky, slow, and costly. Mock tests verify our integration logic. If the API contract changes, we'd need to update mocks anyway."
**Consensus:** Mock Anthropic API in tests.

**QE challenged:** "Should E2E tests run before every commit?"
**SWE 1 response:** "Too slow for pre-commit. Run unit tests pre-commit, E2E manually or in CI."
**Consensus:** Unit tests fast, E2E on-demand.

## Testing Strategy

This IS the testing strategy. Meta-testing: verify Playwright config works, tests can start/stop dev server, and test database resets correctly.

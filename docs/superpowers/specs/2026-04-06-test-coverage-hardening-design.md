# Test Coverage Hardening

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P0 — Foundation for continued development

## Problem

Test coverage has gaps in critical areas: export-markdown.ts has zero tests, several API routes lack unit tests, and there are 2 TypeScript errors in test files. Before adding more features, we need a solid test foundation.

## Design

### Fix TypeScript Errors

1. `src/app/api/documents/[id]/share-link/__tests__/route.test.ts:50` — Fix Prisma mock type
2. `src/app/api/documents/[id]/versions/[versionId]/route.test.ts:61` — Fix version ID type

### New Test Files Needed

**High priority (core business logic):**

1. **`src/lib/__tests__/export-markdown.test.ts`** — Test `xmlFragmentToMarkdown()`:
   - Headings (H1-H6)
   - Paragraphs with inline formatting (bold, italic, code, links)
   - Lists (bullet, ordered, nested)
   - Blockquotes
   - Code blocks (with language)
   - Horizontal rules
   - Mermaid blocks (exported as code blocks)
   - Empty document
   - Suggestion marks filtered out

2. **`src/lib/__tests__/suggestion-store.test.ts`** — Test CRUD operations on Yjs maps:
   - addSuggestion, getSuggestions, updateSuggestionStatus
   - addComment, getComments, resolveComment, addReplyToComment
   - Serialization/deserialization of RelativePosition

3. **`src/lib/__tests__/version-snapshot.test.ts`** — Test snapshot utilities:
   - createSnapshot, restoreSnapshot, pruneAutoSnapshots
   - (Some of these may already exist from R1, verify and fill gaps)

**Medium priority (API routes):**

4. **`src/app/api/auth/register/__tests__/route.test.ts`** — Registration:
   - Valid registration
   - Missing fields (400)
   - Duplicate email (409)
   - Short password (400)

5. **`src/app/api/notifications/__tests__/route.test.ts`** — Notification endpoints:
   - GET with pagination and cursor
   - GET count
   - POST mark-read (specific IDs and all)

6. **`src/app/api/mcp/__tests__/route.test.ts`** — MCP endpoint:
   - GET returns manifest
   - POST executes tools (get_comments, add_comment)

### Test Quality Standards

- Every test file must have at least one happy-path and one error-path test
- Mock external dependencies (Prisma, Yjs, Anthropic API)
- Use descriptive test names that explain the expected behavior
- No `expect(x).toBeDefined()` — test actual behavior and values

## Team Debate Notes

**QE challenged:** "Should we aim for a coverage percentage?"
**PM response:** "No. Coverage metrics encourage bad tests. We test critical paths and business logic. The 6 test files above cover our highest-risk gaps."
**Consensus:** No coverage target. Targeted testing of high-risk code.

## Testing Strategy

This IS the testing strategy. Run `npx vitest run` after all tests are written. Target: zero failures, no regressions.

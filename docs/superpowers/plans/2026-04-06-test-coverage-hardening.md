# Test Coverage Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Fix TypeScript test errors and add tests for critical untested code: export-markdown, suggestion-store, registration API, notification API, MCP endpoint.

**Architecture:** New test files alongside source. Fix 2 existing TS errors. Add 6 new test suites covering highest-risk gaps.

**Tech Stack:** Vitest, @testing-library

---

## File Map

| File | Change |
|---|---|
| `src/app/api/documents/[id]/share-link/__tests__/route.test.ts` | Fix — Prisma mock type error on line 50 |
| `src/app/api/documents/[id]/versions/[versionId]/route.test.ts` | Fix — version ID type error on line 61 |
| `src/lib/__tests__/export-markdown.test.ts` | New — tests for `xmlFragmentToMarkdown()` |
| `src/lib/__tests__/suggestion-store.test.ts` | New — tests for suggestion and comment CRUD on Yjs maps |
| `src/app/api/auth/register/__tests__/route.test.ts` | New — registration endpoint tests |
| `src/app/api/notifications/__tests__/route.test.ts` | New — notification GET endpoint tests |
| `src/app/api/mcp/__tests__/route.test.ts` | New — MCP manifest and tool execution tests |

---

## Task 1: Fix Existing TypeScript Test Errors

**Files:**
- Modify: `src/app/api/documents/[id]/share-link/__tests__/route.test.ts`
- Modify: `src/app/api/documents/[id]/versions/[versionId]/route.test.ts`

- [ ] **Step 1: Fix the share-link test Prisma mock type**

In `src/app/api/documents/[id]/share-link/__tests__/route.test.ts`, the `mockShareCreate.mockImplementation` on line 50 has a type error because `vi.mocked(prisma.documentShare.create)` doesn't match the `async ({ data }: any)` signature.

Find line 50:
```typescript
    mockShareCreate.mockImplementation(async ({ data }: any) => ({
```

Replace with:
```typescript
    (mockShareCreate as any).mockImplementation(async ({ data }: any) => ({
```

- [ ] **Step 2: Fix the versions test — heading level attribute type**

In `src/app/api/documents/[id]/versions/[versionId]/route.test.ts`, line 61 passes a number to `setAttribute("level", 1)` but the Yjs API expects a string or compatible type. The actual issue is that the mock return type for `findUnique` doesn't match.

Find line 61:
```typescript
    heading.setAttribute("level", 1);
```

Replace with:
```typescript
    heading.setAttribute("level", "1");
```

- [ ] **Step 3: Verify both tests pass**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/app/api/documents/\[id\]/share-link/__tests__/route.test.ts src/app/api/documents/\[id\]/versions/\[versionId\]/route.test.ts 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add "src/app/api/documents/[id]/share-link/__tests__/route.test.ts" "src/app/api/documents/[id]/versions/[versionId]/route.test.ts"
git commit -m "fix: resolve TypeScript errors in share-link and version test files"
```

---

## Task 2: Tests for export-markdown.ts (TDD)

**Files:**
- New: `src/lib/__tests__/export-markdown.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/__tests__/export-markdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { xmlFragmentToMarkdown } from "../export-markdown";

function buildFragment(
  setup: (frag: Y.XmlFragment, doc: Y.Doc) => void
): Y.XmlFragment {
  const doc = new Y.Doc();
  const frag = doc.getXmlFragment("default");
  setup(frag, doc);
  return frag;
}

describe("xmlFragmentToMarkdown", () => {
  it("converts H1 heading", () => {
    const frag = buildFragment((f) => {
      const h = new Y.XmlElement("heading");
      h.setAttribute("level", 1);
      h.insert(0, [new Y.XmlText("Hello World")]);
      f.insert(0, [h]);
    });
    expect(xmlFragmentToMarkdown(frag)).toBe("# Hello World\n");
  });

  it("converts H2 and H3 headings", () => {
    const frag = buildFragment((f) => {
      const h2 = new Y.XmlElement("heading");
      h2.setAttribute("level", 2);
      h2.insert(0, [new Y.XmlText("Section")]);
      const h3 = new Y.XmlElement("heading");
      h3.setAttribute("level", 3);
      h3.insert(0, [new Y.XmlText("Subsection")]);
      f.insert(0, [h2, h3]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("## Section");
    expect(md).toContain("### Subsection");
  });

  it("converts a paragraph", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Some text here")]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toBe("Some text here\n");
  });

  it("converts bold inline formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "bold", { bold: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("**bold**");
  });

  it("converts italic inline formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "italic", { italic: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("*italic*");
  });

  it("converts inline code formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "code", { code: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("`code`");
  });

  it("converts strikethrough formatting", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "struck", { strike: true });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("~~struck~~");
  });

  it("converts links", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "click", { link: { href: "https://example.com" } });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("[click](https://example.com)");
  });

  it("converts bullet lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("bulletList");
      const item = new Y.XmlElement("listItem");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Item one")]);
      item.insert(0, [p]);
      list.insert(0, [item]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("- Item one");
  });

  it("converts ordered lists with numbering", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("orderedList");
      const item1 = new Y.XmlElement("listItem");
      const p1 = new Y.XmlElement("paragraph");
      p1.insert(0, [new Y.XmlText("First")]);
      item1.insert(0, [p1]);
      const item2 = new Y.XmlElement("listItem");
      const p2 = new Y.XmlElement("paragraph");
      p2.insert(0, [new Y.XmlText("Second")]);
      item2.insert(0, [p2]);
      list.insert(0, [item1, item2]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("1. First");
    expect(md).toContain("2. Second");
  });

  it("converts nested lists", () => {
    const frag = buildFragment((f) => {
      const list = new Y.XmlElement("bulletList");
      const item = new Y.XmlElement("listItem");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Parent")]);
      const nested = new Y.XmlElement("bulletList");
      const nestedItem = new Y.XmlElement("listItem");
      const nestedP = new Y.XmlElement("paragraph");
      nestedP.insert(0, [new Y.XmlText("Child")]);
      nestedItem.insert(0, [nestedP]);
      nested.insert(0, [nestedItem]);
      item.insert(0, [p, nested]);
      list.insert(0, [item]);
      f.insert(0, [list]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("- Parent");
    expect(md).toContain("  - Child");
  });

  it("converts blockquotes", () => {
    const frag = buildFragment((f) => {
      const bq = new Y.XmlElement("blockquote");
      const p = new Y.XmlElement("paragraph");
      p.insert(0, [new Y.XmlText("Quoted text")]);
      bq.insert(0, [p]);
      f.insert(0, [bq]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("> Quoted text");
  });

  it("converts code blocks with language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.setAttribute("language", "typescript");
      cb.insert(0, [new Y.XmlText("const x = 1;")]);
      f.insert(0, [cb]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("```typescript");
    expect(md).toContain("const x = 1;");
    expect(md).toContain("```");
  });

  it("converts code blocks without language", () => {
    const frag = buildFragment((f) => {
      const cb = new Y.XmlElement("codeBlock");
      cb.insert(0, [new Y.XmlText("plain code")]);
      f.insert(0, [cb]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("```\nplain code\n```");
  });

  it("converts horizontal rules", () => {
    const frag = buildFragment((f) => {
      f.insert(0, [new Y.XmlElement("horizontalRule")]);
    });
    expect(xmlFragmentToMarkdown(frag)).toContain("---");
  });

  it("filters out suggestion-delete marks", () => {
    const frag = buildFragment((f) => {
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, "keep this");
      text.insert(9, "remove this", {
        suggestionMark: { type: "delete" },
      });
      p.insert(0, [text]);
      f.insert(0, [p]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("keep this");
    expect(md).not.toContain("remove this");
  });

  it("handles empty document", () => {
    const frag = buildFragment(() => {});
    expect(xmlFragmentToMarkdown(frag)).toBe("\n");
  });

  it("handles empty paragraphs without adding extra whitespace", () => {
    const frag = buildFragment((f) => {
      const p1 = new Y.XmlElement("paragraph");
      p1.insert(0, [new Y.XmlText("First")]);
      const p2 = new Y.XmlElement("paragraph");
      // empty paragraph
      const p3 = new Y.XmlElement("paragraph");
      p3.insert(0, [new Y.XmlText("Third")]);
      f.insert(0, [p1, p2, p3]);
    });
    const md = xmlFragmentToMarkdown(frag);
    expect(md).toContain("First");
    expect(md).toContain("Third");
    // Should not have more than 2 consecutive newlines
    expect(md).not.toMatch(/\n{3,}/);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/export-markdown.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/__tests__/export-markdown.test.ts
git commit -m "test: add comprehensive unit tests for xmlFragmentToMarkdown"
```

---

## Task 3: Tests for suggestion-store.ts

**Files:**
- New: `src/lib/__tests__/suggestion-store.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/__tests__/suggestion-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import {
  addSuggestion,
  getSuggestions,
  updateSuggestionStatus,
  addComment,
  getComments,
  resolveComment,
  addReplyToComment,
} from "../suggestion-store";
import type { Suggestion, Comment, CommentReply } from "@/types";

function createTestDoc(): Y.Doc {
  return new Y.Doc();
}

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: "sug-1",
    documentId: "doc-1",
    authorName: "Alice",
    authorType: "human",
    originalText: "old text",
    suggestedText: "new text",
    rationale: "improves clarity",
    status: "pending",
    startRelPos: new Uint8Array([1, 2, 3]),
    endRelPos: new Uint8Array([4, 5, 6]),
    contentHash: "abc123",
    createdAt: "2026-04-06T10:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "comment-1",
    documentId: "doc-1",
    authorName: "Bob",
    authorType: "human",
    content: "This needs work",
    startRelPos: new Uint8Array([10, 20]),
    endRelPos: new Uint8Array([30, 40]),
    parentCommentId: null,
    resolved: false,
    createdAt: "2026-04-06T10:00:00Z",
    replies: [],
    ...overrides,
  };
}

describe("suggestion-store: suggestions", () => {
  let ydoc: Y.Doc;

  beforeEach(() => {
    ydoc = createTestDoc();
  });

  it("adds and retrieves a suggestion", () => {
    const sug = makeSuggestion();
    addSuggestion(ydoc, sug);
    const results = getSuggestions(ydoc);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("sug-1");
    expect(results[0].originalText).toBe("old text");
    expect(results[0].suggestedText).toBe("new text");
    expect(results[0].status).toBe("pending");
  });

  it("preserves RelativePosition through serialization roundtrip", () => {
    const sug = makeSuggestion({
      startRelPos: new Uint8Array([10, 20, 30]),
      endRelPos: new Uint8Array([40, 50, 60]),
    });
    addSuggestion(ydoc, sug);
    const results = getSuggestions(ydoc);
    expect(Array.from(results[0].startRelPos)).toEqual([10, 20, 30]);
    expect(Array.from(results[0].endRelPos)).toEqual([40, 50, 60]);
  });

  it("adds multiple suggestions", () => {
    addSuggestion(ydoc, makeSuggestion({ id: "sug-1" }));
    addSuggestion(ydoc, makeSuggestion({ id: "sug-2", originalText: "other" }));
    const results = getSuggestions(ydoc);
    expect(results).toHaveLength(2);
  });

  it("updates suggestion status to accepted", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "sug-1", "accepted");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("accepted");
    expect(results[0].resolvedAt).toBeTruthy();
  });

  it("updates suggestion status to rejected", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "sug-1", "rejected");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("rejected");
    expect(results[0].resolvedAt).toBeTruthy();
  });

  it("does nothing when updating non-existent suggestion", () => {
    addSuggestion(ydoc, makeSuggestion());
    updateSuggestionStatus(ydoc, "non-existent", "accepted");
    const results = getSuggestions(ydoc);
    expect(results[0].status).toBe("pending");
  });

  it("returns empty array when no suggestions", () => {
    expect(getSuggestions(ydoc)).toEqual([]);
  });
});

describe("suggestion-store: comments", () => {
  let ydoc: Y.Doc;

  beforeEach(() => {
    ydoc = createTestDoc();
  });

  it("adds and retrieves a comment", () => {
    const comment = makeComment();
    addComment(ydoc, comment);
    const results = getComments(ydoc);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("comment-1");
    expect(results[0].content).toBe("This needs work");
    expect(results[0].resolved).toBe(false);
  });

  it("preserves RelativePosition through serialization roundtrip", () => {
    const comment = makeComment({
      startRelPos: new Uint8Array([100, 200]),
      endRelPos: new Uint8Array([150, 250]),
    });
    addComment(ydoc, comment);
    const results = getComments(ydoc);
    expect(Array.from(results[0].startRelPos)).toEqual([100, 200]);
    expect(Array.from(results[0].endRelPos)).toEqual([150, 250]);
  });

  it("resolves a comment", () => {
    addComment(ydoc, makeComment());
    resolveComment(ydoc, "comment-1");
    const results = getComments(ydoc);
    expect(results[0].resolved).toBe(true);
  });

  it("does nothing when resolving non-existent comment", () => {
    addComment(ydoc, makeComment());
    resolveComment(ydoc, "non-existent");
    const results = getComments(ydoc);
    expect(results[0].resolved).toBe(false);
  });

  it("adds a reply to a comment", () => {
    addComment(ydoc, makeComment());
    const reply: CommentReply = {
      id: "reply-1",
      text: "Good point",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    };
    addReplyToComment(ydoc, "comment-1", reply);
    const results = getComments(ydoc);
    expect(results[0].replies).toHaveLength(1);
    expect(results[0].replies![0].text).toBe("Good point");
    expect(results[0].replies![0].author).toBe("Carol");
  });

  it("adds multiple replies to a comment", () => {
    addComment(ydoc, makeComment());
    addReplyToComment(ydoc, "comment-1", {
      id: "reply-1",
      text: "First reply",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    });
    addReplyToComment(ydoc, "comment-1", {
      id: "reply-2",
      text: "Second reply",
      author: "Dave",
      createdAt: "2026-04-06T12:00:00Z",
    });
    const results = getComments(ydoc);
    expect(results[0].replies).toHaveLength(2);
  });

  it("does nothing when adding reply to non-existent comment", () => {
    addComment(ydoc, makeComment());
    addReplyToComment(ydoc, "non-existent", {
      id: "reply-1",
      text: "orphan reply",
      author: "Carol",
      createdAt: "2026-04-06T11:00:00Z",
    });
    const results = getComments(ydoc);
    expect(results[0].replies).toEqual([]);
  });

  it("returns empty array when no comments", () => {
    expect(getComments(ydoc)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/suggestion-store.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/__tests__/suggestion-store.test.ts
git commit -m "test: add unit tests for suggestion-store CRUD operations"
```

---

## Task 4: Tests for Registration API

**Files:**
- New: `src/app/api/auth/register/__tests__/route.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/app/api/auth/register/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
  },
}));

import { prisma } from "@/lib/prisma";
import { POST } from "../route";

const mockFindUnique = vi.mocked(prisma.user.findUnique);
const mockCreate = vi.mocked(prisma.user.create);

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a new user successfully", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    }));

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(makeRequest({
      email: "alice@example.com",
      password: "password123",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 when email is missing", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      password: "password123",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is too short", async () => {
    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "12345",
    }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("6 characters");
  });

  it("returns 409 when email already exists", async () => {
    mockFindUnique.mockResolvedValue({
      id: "existing",
      name: "Existing",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    });

    const res = await POST(makeRequest({
      name: "Alice",
      email: "alice@example.com",
      password: "password123",
    }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already registered");
  });

  it("lowercases email before checking and storing", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    });

    await POST(makeRequest({
      name: "Alice",
      email: "Alice@Example.COM",
      password: "password123",
    }));

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { email: "alice@example.com" },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "alice@example.com",
      }),
    });
  });

  it("trims whitespace from name", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      email: "alice@example.com",
      password: "hashed",
      createdAt: new Date(),
    });

    await POST(makeRequest({
      name: "  Alice  ",
      email: "alice@example.com",
      password: "password123",
    }));

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Alice",
      }),
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/app/api/auth/register/__tests__/route.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add -f "src/app/api/auth/register/__tests__/route.test.ts"
git commit -m "test: add unit tests for registration API endpoint"
```

---

## Task 5: Tests for Notifications API Route

**Files:**
- New: `src/app/api/notifications/__tests__/route.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/app/api/notifications/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET } from "../route";

const mockGetSession = vi.mocked(getServerSession);
const mockFindMany = vi.mocked(prisma.notification.findMany);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/notifications");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString()) as any;
}

describe("GET /api/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns notifications for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);

    const notifications = [
      {
        id: "notif-1",
        userId: "user-1",
        type: "comment",
        documentId: "doc-1",
        documentTitle: "Test Doc",
        actorName: "Alice",
        actorId: "actor-1",
        message: "Alice commented on Test Doc",
        read: false,
        createdAt: new Date("2026-04-06T10:00:00Z"),
      },
    ];
    mockFindMany.mockResolvedValue(notifications);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("notif-1");
    expect(data[0].type).toBe("comment");
  });

  it("filters unread only when unread=true", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest({ unread: "true" }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1", read: false }),
      })
    );
  });

  it("respects limit parameter capped at 50", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest({ limit: "100" }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("uses cursor for pagination", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    const cursor = "2026-04-06T10:00:00Z";
    await GET(makeRequest({ cursor }));

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { lt: new Date(cursor) },
        }),
      })
    );
  });

  it("defaults to limit of 20", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com" },
      expires: "never",
    } as any);
    mockFindMany.mockResolvedValue([]);

    await GET(makeRequest());

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
      })
    );
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/app/api/notifications/__tests__/route.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add -f "src/app/api/notifications/__tests__/route.test.ts"
git commit -m "test: add unit tests for notifications GET API endpoint"
```

---

## Task 6: Tests for MCP Endpoint

**Files:**
- New: `src/app/api/mcp/__tests__/route.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/app/api/mcp/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/yjs-server-connect", () => ({
  connectYjsServer: vi.fn(),
}));

vi.mock("@/lib/suggestion-store", () => ({
  addComment: vi.fn(),
  getComments: vi.fn().mockReturnValue([]),
}));

import { prisma } from "@/lib/prisma";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { getComments, addComment } from "@/lib/suggestion-store";
import { GET, POST } from "../route";

const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockConnectYjs = vi.mocked(connectYjsServer);
const mockGetComments = vi.mocked(getComments);
const mockAddComment = vi.mocked(addComment);

function makeJsonRpcRequest(method: string, params: Record<string, unknown> = {}, id: number = 1) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  }) as any;
}

describe("GET /api/mcp (manifest)", () => {
  it("returns the MCP manifest with tool definitions", async () => {
    const res = await GET();
    const data = await res.json();

    expect(data.schema_version).toBe("v1");
    expect(data.name).toBe("markdowncollab-mcp");
    expect(data.tools).toHaveLength(2);
    expect(data.tools[0].name).toBe("get_comments");
    expect(data.tools[1].name).toBe("add_comment");
  });

  it("includes input_schema for each tool", async () => {
    const res = await GET();
    const data = await res.json();

    for (const tool of data.tools) {
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe("object");
      expect(tool.input_schema.properties.document_id).toBeDefined();
    }
  });
});

describe("POST /api/mcp (tool execution)", () => {
  const mockYdoc = {} as any;
  const mockCleanup = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectYjs.mockResolvedValue({
      ydoc: mockYdoc,
      awareness: {} as any,
      cleanup: mockCleanup,
    });
  });

  it("returns parse error for invalid JSON", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json{",
    }) as any;

    const res = await POST(req);
    const data = await res.json();
    expect(data.error.code).toBe(-32700);
  });

  it("returns invalid request for non-JSON-RPC body", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    }) as any;

    const res = await POST(req);
    const data = await res.json();
    expect(data.error.code).toBe(-32600);
  });

  it("returns method not found for unknown method", async () => {
    const res = await POST(makeJsonRpcRequest("unknown_method"));
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
    expect(data.error.message).toContain("unknown_method");
  });

  it("get_comments returns empty array when document not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const res = await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.result.comments).toEqual([]);
    expect(data.result.error).toContain("not found");
  });

  it("get_comments returns comments from Yjs", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockGetComments.mockReturnValue([
      {
        id: "c-1",
        documentId: "doc-1",
        authorName: "Alice",
        authorType: "human",
        content: "Fix this",
        startRelPos: new Uint8Array(),
        endRelPos: new Uint8Array(),
        parentCommentId: null,
        resolved: false,
        createdAt: "2026-04-06T10:00:00Z",
        replies: [],
      },
    ]);

    const res = await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.result.comments).toHaveLength(1);
    expect(data.result.comments[0].content).toBe("Fix this");
    expect(data.result.comments[0].author).toBe("Alice");
  });

  it("get_comments requires document_id", async () => {
    const res = await POST(makeJsonRpcRequest("get_comments", {}));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("get_comments validates status parameter", async () => {
    const res = await POST(makeJsonRpcRequest("get_comments", {
      document_id: "doc-1",
      status: "invalid",
    }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
    expect(data.error.message).toContain("status");
  });

  it("add_comment creates a comment and returns success", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);

    const res = await POST(makeJsonRpcRequest("add_comment", {
      document_id: "doc-1",
      content: "Great work!",
      author_name: "Bot",
    }));
    const data = await res.json();
    expect(data.result.success).toBe(true);
    expect(data.result.author).toBe("Bot");
    expect(data.result.comment_id).toBeTruthy();
    expect(mockAddComment).toHaveBeenCalled();
  });

  it("add_comment requires document_id", async () => {
    const res = await POST(makeJsonRpcRequest("add_comment", { content: "test" }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("add_comment requires content", async () => {
    const res = await POST(makeJsonRpcRequest("add_comment", { document_id: "doc-1" }));
    const data = await res.json();
    expect(data.error.code).toBe(-32602);
  });

  it("add_comment defaults author to 'AI Agent'", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);

    const res = await POST(makeJsonRpcRequest("add_comment", {
      document_id: "doc-1",
      content: "Note",
    }));
    const data = await res.json();
    expect(data.result.author).toBe("AI Agent");
  });

  it("cleans up Yjs connection after get_comments", async () => {
    mockFindUnique.mockResolvedValue({ id: "doc-1" } as any);
    mockGetComments.mockReturnValue([]);

    await POST(makeJsonRpcRequest("get_comments", { document_id: "doc-1" }));
    expect(mockCleanup).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/app/api/mcp/__tests__/route.test.ts 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add -f "src/app/api/mcp/__tests__/route.test.ts"
git commit -m "test: add unit tests for MCP manifest and JSON-RPC tool execution"
```

---

## Task 7: Full Test Suite Verification

- [ ] **Step 1: Run the complete test suite**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run 2>&1 | tail -20
```

All tests must pass with zero failures.

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd /Users/ronica/projects/markdown-collab
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: If any tests fail, fix them and re-run**

Iterate until `npx vitest run` reports zero failures.

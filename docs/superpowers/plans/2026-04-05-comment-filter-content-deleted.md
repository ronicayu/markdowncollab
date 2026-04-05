# Comment Filter & Content-Deleted Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dropdown filter (Open / Resolved / All) to the comment sidebar and visually flag comments whose annotated text has been deleted from the document.

**Architecture:** `activeCommentIds` (a `Set<string>`) is derived from the live Tiptap editor document on every `update` event and seeded on `onEditorReady`. It flows down: `page.tsx` → `CommentSidebar` → `CommentCard`. A comment is "content deleted" when `!comment.resolved && !activeCommentIds.has(comment.id)`. Filter state lives locally in `CommentSidebar`. No Yjs store changes.

**Tech Stack:** Next.js 15, React, Tiptap, Yjs, Vitest + jsdom, Tailwind CSS

---

## Task 0: Install test dependencies

**Files:** `package.json` (updated by npm)

- [ ] **Step 1: Install @testing-library/react and @testing-library/jest-dom**

```bash
cd /Users/ronica/projects/markdown-collab
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Verify vitest can find the test environment**

```bash
npx vitest run --reporter=verbose 2>&1 | head -20
```

Expected: vitest starts without config errors (may show "no test files found" — that's fine).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @testing-library/react for component tests"
```

---

## File Map

| File | Change |
|---|---|
| `src/components/CommentCard.tsx` | Remove resolved null-guard; add `isContentDeleted` prop; three visual states |
| `src/components/CommentSidebar.tsx` | Add `filter` state + `<select>` dropdown; accept + forward `activeCommentIds`; filter logic |
| `src/app/doc/[id]/page.tsx` | Add `activeCommentIds` state; seed on `onEditorReady` + `update` event; pass to sidebar |
| `src/components/__tests__/CommentCard.test.tsx` | New — unit tests for three card states |
| `src/components/__tests__/CommentSidebar.test.tsx` | New — unit tests for filter logic |

---

## Task 1: Update CommentCard

**Files:**
- Modify: `src/components/CommentCard.tsx`
- Create: `src/components/__tests__/CommentCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/CommentCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommentCard from "../CommentCard";
import type { Comment } from "@/types";

const base: Comment = {
  id: "abc",
  documentId: "doc1",
  authorName: "Alice",
  authorType: "human",
  content: "This needs work",
  startRelPos: new Uint8Array(),
  endRelPos: new Uint8Array(),
  parentCommentId: null,
  resolved: false,
  createdAt: new Date().toISOString(),
};

describe("CommentCard", () => {
  it("shows Resolve button when comment is open", () => {
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    expect(screen.getByRole("button", { name: /resolve/i })).toBeDefined();
  });

  it("shows content-deleted badge and Resolve button when isContentDeleted", () => {
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        isActive={false}
        isContentDeleted={true}
      />
    );
    expect(screen.getByText(/content deleted/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /resolve/i })).toBeDefined();
  });

  it("shows resolved badge and no Resolve button when resolved", () => {
    render(
      <CommentCard
        comment={{ ...base, resolved: true }}
        onClick={vi.fn()}
        onResolve={vi.fn()}
        isActive={false}
        isContentDeleted={false}
      />
    );
    expect(screen.getByText(/resolved/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /resolve/i })).toBeNull();
  });

  it("calls onResolve with comment id when Resolve clicked", () => {
    const onResolve = vi.fn();
    render(
      <CommentCard
        comment={base}
        onClick={vi.fn()}
        onResolve={onResolve}
        isActive={false}
        isContentDeleted={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /resolve/i }));
    expect(onResolve).toHaveBeenCalledWith("abc");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/CommentCard.test.tsx
```

Expected: failures — `isContentDeleted` prop doesn't exist yet, resolved card returns null.

- [ ] **Step 3: Rewrite CommentCard**

Replace `src/components/CommentCard.tsx` with:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Comment } from "@/types";

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
  isActive?: boolean;
  isContentDeleted: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

export default function CommentCard({
  comment,
  onClick,
  onResolve,
  isActive,
  isContentDeleted,
}: CommentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const isAgent = comment.authorType === "agent";

  const cardClass = comment.resolved
    ? "rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm opacity-60"
    : isActive
    ? "cursor-pointer rounded-lg border border-amber-400 bg-amber-50 p-3 ring-2 ring-amber-300 shadow-sm transition-all hover:shadow-md"
    : "cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md";

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => !comment.resolved && onClick(comment.id)}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${
            isAgent ? "bg-gray-700" : "bg-green-600"
          }`}
        >
          {isAgent ? (
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47"
              />
            </svg>
          ) : (
            getInitials(comment.authorName)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${comment.resolved ? "text-gray-500" : "text-gray-900"}`}>
            {comment.authorName}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
      </div>

      <p className={`mb-2 text-sm ${comment.resolved ? "text-gray-400" : "text-gray-600"}`}>
        {comment.content}
      </p>

      {comment.resolved ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Resolved
        </span>
      ) : (
        <div className="flex items-center justify-between">
          {isContentDeleted && (
            <span className="text-xs text-amber-600 font-medium">Content deleted</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(comment.id);
            }}
            className={`text-xs font-medium text-gray-400 hover:text-green-600 transition-colors ${isContentDeleted ? "" : "ml-auto"}`}
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/__tests__/CommentCard.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommentCard.tsx src/components/__tests__/CommentCard.test.tsx
git commit -m "feat: update CommentCard with resolved/content-deleted visual states"
```

---

## Task 2: Update CommentSidebar

**Files:**
- Modify: `src/components/CommentSidebar.tsx`
- Create: `src/components/__tests__/CommentSidebar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/CommentSidebar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CommentSidebar from "../CommentSidebar";
import type { Comment } from "@/types";

const makeComment = (id: string, resolved: boolean): Comment => ({
  id,
  documentId: "doc1",
  authorName: "Alice",
  authorType: "human",
  content: `Comment ${id}`,
  startRelPos: new Uint8Array(),
  endRelPos: new Uint8Array(),
  parentCommentId: null,
  resolved,
  createdAt: new Date().toISOString(),
});

const defaultProps = {
  suggestions: [],
  comments: [makeComment("open1", false), makeComment("resolved1", true)],
  activeCommentIds: new Set(["open1"]),
  onAcceptSuggestion: vi.fn(),
  onRejectSuggestion: vi.fn(),
  onClickItem: vi.fn(),
  onAddComment: vi.fn(),
  onResolveComment: vi.fn(),
  hasSelection: false,
  activeCommentId: null,
};

describe("CommentSidebar filter", () => {
  it("shows only open comments by default", () => {
    render(<CommentSidebar {...defaultProps} />);
    expect(screen.getByText("Comment open1")).toBeDefined();
    expect(screen.queryByText("Comment resolved1")).toBeNull();
  });

  it("shows only resolved comments when filter is Resolved", () => {
    render(<CommentSidebar {...defaultProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "resolved" } });
    expect(screen.queryByText("Comment open1")).toBeNull();
    expect(screen.getByText("Comment resolved1")).toBeDefined();
  });

  it("shows all comments when filter is All", () => {
    render(<CommentSidebar {...defaultProps} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "all" } });
    expect(screen.getByText("Comment open1")).toBeDefined();
    expect(screen.getByText("Comment resolved1")).toBeDefined();
  });

  it("hides + Comment button when filter is Resolved", () => {
    render(<CommentSidebar {...defaultProps} hasSelection={true} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "resolved" } });
    expect(screen.queryByText("+ Comment")).toBeNull();
  });

  it("shows + Comment button when filter is Open and text is selected", () => {
    render(<CommentSidebar {...defaultProps} hasSelection={true} />);
    expect(screen.getByText("+ Comment")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/__tests__/CommentSidebar.test.tsx
```

Expected: failures — `activeCommentIds` prop missing, filter select not present.

- [ ] **Step 3: Rewrite CommentSidebar**

Replace `src/components/CommentSidebar.tsx` with:

```tsx
"use client";

import { useState } from "react";
import type { Suggestion, Comment } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";

type Filter = "open" | "resolved" | "all";

interface CommentSidebarProps {
  suggestions: Suggestion[];
  comments: Comment[];
  activeCommentIds: Set<string>;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClickItem: (id: string) => void;
  onAddComment: (text: string) => void;
  onResolveComment: (id: string) => void;
  hasSelection: boolean;
  activeCommentId?: string | null;
}

export default function CommentSidebar({
  suggestions,
  comments,
  activeCommentIds,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClickItem,
  onAddComment,
  onResolveComment,
  hasSelection,
  activeCommentId,
}: CommentSidebarProps) {
  const [commentText, setCommentText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === "pending" || s.status === "stale"
  );

  const filteredComments = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  function handleSubmit() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
    setShowInput(false);
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-[#E8D8C0] bg-[#F5EBD8] p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold text-gray-700 shrink-0">Comments</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="text-xs border border-[#D4A978] rounded-md px-1.5 py-1 bg-[#FFFEF9] text-gray-600 focus:outline-none focus:border-[#B8692A] cursor-pointer"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        {hasSelection && filter !== "resolved" && (
          <button
            onClick={() => setShowInput(true)}
            className="text-xs font-medium text-[#B8692A] hover:text-[#96541F] shrink-0"
          >
            + Comment
          </button>
        )}
      </div>

      {/* New comment input */}
      {showInput && (
        <div className="mb-3 rounded-lg border border-[#D4A978] bg-[#FFFEF9] p-3">
          <p className="text-xs text-gray-500 mb-2">Comment on selected text:</p>
          <textarea
            autoFocus
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") {
                setShowInput(false);
                setCommentText("");
              }
            }}
            placeholder="Type your comment..."
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#B8692A]"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowInput(false); setCommentText(""); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-3 py-1 rounded-md"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Suggestions ({pendingSuggestions.length})
          </p>
          {pendingSuggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAccept={onAcceptSuggestion}
              onReject={onRejectSuggestion}
              onClick={onClickItem}
            />
          ))}
        </div>
      )}

      {/* Comments */}
      {filteredComments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Comments ({filteredComments.length})
          </p>
          {filteredComments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onClick={onClickItem}
              onResolve={onResolveComment}
              isActive={c.id === activeCommentId}
              isContentDeleted={!c.resolved && !activeCommentIds.has(c.id)}
            />
          ))}
        </div>
      )}

      {filteredComments.length === 0 && pendingSuggestions.length === 0 && !showInput && (
        <p className="text-xs text-gray-400">
          {filter === "resolved"
            ? "No resolved comments yet."
            : hasSelection
            ? 'Select text and click "+ Comment" to leave a comment.'
            : "Select text in the editor to add comments."}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/__tests__/CommentSidebar.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CommentSidebar.tsx src/components/__tests__/CommentSidebar.test.tsx
git commit -m "feat: add comment filter dropdown and activeCommentIds prop to sidebar"
```

---

## Task 3: Wire activeCommentIds in the document page

**Files:**
- Modify: `src/app/doc/[id]/page.tsx`

No new tests — this wiring layer depends on Tiptap + Yjs and is verified manually.

- [ ] **Step 1: Add the helper and state**

In `src/app/doc/[id]/page.tsx`, after the existing `const [editor, setEditor] = useState...` line (around line 141), add:

```tsx
const [activeCommentIds, setActiveCommentIds] = useState<Set<string>>(new Set());
```

Add this helper function just above the `useEffect` blocks (e.g. after `getUserName`):

```tsx
function collectActiveCommentIds(editorInstance: import("@tiptap/core").Editor): Set<string> {
  const ids = new Set<string>();
  editorInstance.state.doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === "commentMark") {
        ids.add(mark.attrs.commentId as string);
      }
    });
  });
  return ids;
}
```

- [ ] **Step 2: Seed on editor ready and subscribe to updates**

The existing `onEditorReady={setEditor}` callback sets the editor. Replace it with a combined handler. Find this line:

```tsx
const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(
  null
);
```

Change the `onEditorReady` prop on `<Editor>` from:

```tsx
onEditorReady={setEditor}
```

to:

```tsx
onEditorReady={(e) => {
  setEditor(e);
  setActiveCommentIds(collectActiveCommentIds(e));
  e.on("update", () => setActiveCommentIds(collectActiveCommentIds(e)));
}}
```

- [ ] **Step 3: Pass activeCommentIds to CommentSidebar**

Find the `<CommentSidebar` JSX block (around line 499) and add the new prop:

```tsx
<CommentSidebar
  suggestions={suggestions}
  comments={comments}
  activeCommentIds={activeCommentIds}
  onAcceptSuggestion={handleAccept}
  onRejectSuggestion={handleReject}
  onClickItem={handleClickItem}
  onAddComment={handleAddComment}
  onResolveComment={handleResolveComment}
  hasSelection={hasSelection}
  activeCommentId={activeCommentId}
/>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/ronica/projects/markdown-collab
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual verification**

Start the dev server and open a document:

```bash
npm run dev
```

Open `http://localhost:3000`, open or create a document.

Verify:
1. Sidebar header shows "Comments" + "Open" dropdown + no "+ Comment" (no selection).
2. Select some text → "+ Comment" appears. Add a comment. It appears in Open filter.
3. Click "Resolve" on the comment. It disappears from Open filter.
4. Switch dropdown to "Resolved" — the resolved comment appears with a green checkmark, no Resolve button. "+ Comment" is hidden.
5. Switch to "All" — both open and resolved comments appear.
6. Add a second comment, then delete the annotated text in the editor. Switch to Open — the comment should show an amber "Content deleted" badge with Resolve still available.

- [ ] **Step 6: Commit**

```bash
git add src/app/doc/[id]/page.tsx
git commit -m "feat: wire activeCommentIds from editor marks to comment sidebar"
```

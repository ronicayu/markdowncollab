# Find & Replace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add find and replace functionality with keyboard shortcuts, match highlighting, and case sensitivity toggle.

**Architecture:** Custom Tiptap extension with ProseMirror plugin for search decorations. React component for search/replace bar. Local-only search state (not synced via Yjs).

**Tech Stack:** Tiptap/ProseMirror, React, Tailwind

---

## File Map

| File | Change |
|---|---|
| `src/lib/search-utils.ts` | New — pure functions: `findTextMatches()` maps query to ProseMirror positions |
| `src/lib/__tests__/search-utils.test.ts` | New — unit tests for search utility functions |
| `src/extensions/search-replace.ts` | New — Tiptap extension with ProseMirror plugin, decorations, and commands |
| `src/extensions/__tests__/search-replace.test.ts` | New — unit tests for extension commands and decoration logic |
| `src/components/SearchBar.tsx` | New — find/replace UI bar with inputs, buttons, match counter |
| `src/components/__tests__/SearchBar.test.tsx` | New — unit tests for SearchBar component |
| `src/components/Editor.tsx` | Modified — register SearchReplace extension, render SearchBar, pass editor ref |
| `src/components/Toolbar.tsx` | Modified — add find button to toolbar |

---

## Task 1: Search Utility Functions

**Files:**
- Create: `src/lib/__tests__/search-utils.test.ts`
- Create: `src/lib/search-utils.ts`

- [ ] **Step 1: Create the test file with failing tests**

Create `src/lib/__tests__/search-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findTextMatches, type SearchMatch } from "../search-utils";
import { Schema } from "@tiptap/pm/model";

// Minimal ProseMirror schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 } },
    },
  },
});

function makeDoc(...paragraphs: string[]) {
  return schema.node(
    "doc",
    null,
    paragraphs.map((text) =>
      schema.node("paragraph", null, text ? [schema.text(text)] : [])
    )
  );
}

describe("findTextMatches", () => {
  it("returns empty array when query is empty", () => {
    const doc = makeDoc("Hello world");
    expect(findTextMatches(doc, "", false)).toEqual([]);
  });

  it("returns empty array when no matches found", () => {
    const doc = makeDoc("Hello world");
    expect(findTextMatches(doc, "xyz", false)).toEqual([]);
  });

  it("finds a single match", () => {
    const doc = makeDoc("Hello world");
    const matches = findTextMatches(doc, "world", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("world");
  });

  it("finds multiple matches in one paragraph", () => {
    const doc = makeDoc("the cat sat on the mat");
    const matches = findTextMatches(doc, "the", false);
    expect(matches).toHaveLength(2);
  });

  it("finds matches across multiple paragraphs", () => {
    const doc = makeDoc("Hello world", "Hello again");
    const matches = findTextMatches(doc, "Hello", false);
    expect(matches).toHaveLength(2);
  });

  it("case-insensitive search matches regardless of case", () => {
    const doc = makeDoc("Hello HELLO hello");
    const matches = findTextMatches(doc, "hello", false);
    expect(matches).toHaveLength(3);
  });

  it("case-sensitive search only matches exact case", () => {
    const doc = makeDoc("Hello HELLO hello");
    const matches = findTextMatches(doc, "hello", true);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("hello");
  });

  it("returns correct ProseMirror positions", () => {
    // ProseMirror: doc(0) > paragraph(1) > text starts at pos 1
    // "Hello world" — "world" starts at index 6, so pos = 1 + 6 = 7
    const doc = makeDoc("Hello world");
    const matches = findTextMatches(doc, "world", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].from).toBe(7);
    expect(matches[0].to).toBe(12);
  });

  it("handles empty document", () => {
    const doc = makeDoc("");
    expect(findTextMatches(doc, "test", false)).toEqual([]);
  });

  it("handles special regex characters in query", () => {
    const doc = makeDoc("price is $100.00 (USD)");
    const matches = findTextMatches(doc, "$100.00", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("$100.00");
  });

  it("finds matches in heading nodes", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 1 }, [schema.text("My Title")]),
      schema.node("paragraph", null, [schema.text("body text")]),
    ]);
    const matches = findTextMatches(doc, "Title", false);
    expect(matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/search-utils.test.ts 2>&1 | tail -5
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement search-utils.ts**

Create `src/lib/search-utils.ts`:

```ts
import type { Node as PmNode } from "@tiptap/pm/model";

export interface SearchMatch {
  from: number;
  to: number;
  text: string;
}

/**
 * Escape special regex characters in a string so it can be used as a literal
 * pattern inside a RegExp constructor.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Find all occurrences of `query` in a ProseMirror document.
 * Returns an array of { from, to, text } with absolute document positions.
 *
 * `caseSensitive` controls whether matching respects letter case.
 */
export function findTextMatches(
  doc: PmNode,
  query: string,
  caseSensitive: boolean
): SearchMatch[] {
  if (!query) return [];

  const matches: SearchMatch[] = [];
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegex(query), flags);

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(node.text)) !== null) {
      matches.push({
        from: pos + match.index,
        to: pos + match.index + match[0].length,
        text: match[0],
      });
    }
  });

  return matches;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/search-utils.test.ts 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/search-utils.ts src/lib/__tests__/search-utils.test.ts
git commit -m "feat: add search utility functions for find-and-replace

Pure functions to find text matches in ProseMirror documents with
case-sensitivity support. Returns absolute document positions."
```

---

## Task 2: Tiptap Search-Replace Extension

**Files:**
- Create: `src/extensions/__tests__/search-replace.test.ts`
- Create: `src/extensions/search-replace.ts`

- [ ] **Step 1: Write failing tests for the extension**

Create `src/extensions/__tests__/search-replace.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SearchReplace, searchReplacePluginKey } from "../search-replace";

function createEditor(content: string) {
  return new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      SearchReplace,
    ],
    content,
  });
}

describe("SearchReplace extension", () => {
  it("registers without errors", () => {
    const editor = createEditor("<p>Hello world</p>");
    expect(editor).toBeDefined();
    editor.destroy();
  });

  it("setSearchQuery command updates plugin state", () => {
    const editor = createEditor("<p>Hello world hello</p>");
    editor.commands.setSearchQuery("hello");
    const state = searchReplacePluginKey.getState(editor.state);
    expect(state?.query).toBe("hello");
    expect(state?.matches).toHaveLength(2);
    expect(state?.currentIndex).toBe(0);
    editor.destroy();
  });

  it("findNext advances currentIndex", () => {
    const editor = createEditor("<p>hello hello hello</p>");
    editor.commands.setSearchQuery("hello");
    editor.commands.findNext();
    const state = searchReplacePluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(1);
    editor.destroy();
  });

  it("findNext wraps around", () => {
    const editor = createEditor("<p>hello hello</p>");
    editor.commands.setSearchQuery("hello");
    editor.commands.findNext(); // index 1
    editor.commands.findNext(); // wraps to 0
    const state = searchReplacePluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(0);
    editor.destroy();
  });

  it("findPrevious goes backwards and wraps", () => {
    const editor = createEditor("<p>hello hello hello</p>");
    editor.commands.setSearchQuery("hello");
    // currentIndex starts at 0, going previous wraps to last
    editor.commands.findPrevious();
    const state = searchReplacePluginKey.getState(editor.state);
    expect(state?.currentIndex).toBe(2);
    editor.destroy();
  });

  it("replaceCurrent replaces the current match", () => {
    const editor = createEditor("<p>hello world</p>");
    editor.commands.setSearchQuery("hello");
    editor.commands.replaceCurrent("goodbye");
    expect(editor.state.doc.textContent).toBe("goodbye world");
    editor.destroy();
  });

  it("replaceAll replaces every match", () => {
    const editor = createEditor("<p>hello world hello</p>");
    editor.commands.setSearchQuery("hello");
    editor.commands.replaceAll("goodbye");
    expect(editor.state.doc.textContent).toBe("goodbye world goodbye");
    editor.destroy();
  });

  it("toggleCaseSensitive flips case sensitivity", () => {
    const editor = createEditor("<p>Hello hello HELLO</p>");
    editor.commands.setSearchQuery("hello");
    let state = searchReplacePluginKey.getState(editor.state);
    expect(state?.matches).toHaveLength(3); // case insensitive by default

    editor.commands.toggleCaseSensitive();
    state = searchReplacePluginKey.getState(editor.state);
    expect(state?.caseSensitive).toBe(true);
    expect(state?.matches).toHaveLength(1);
    editor.destroy();
  });

  it("clearSearch resets all state", () => {
    const editor = createEditor("<p>hello world</p>");
    editor.commands.setSearchQuery("hello");
    editor.commands.clearSearch();
    const state = searchReplacePluginKey.getState(editor.state);
    expect(state?.query).toBe("");
    expect(state?.matches).toHaveLength(0);
    expect(state?.currentIndex).toBe(0);
    editor.destroy();
  });

  it("replaceCurrent does nothing when no matches", () => {
    const editor = createEditor("<p>hello world</p>");
    editor.commands.setSearchQuery("xyz");
    editor.commands.replaceCurrent("abc");
    expect(editor.state.doc.textContent).toBe("hello world");
    editor.destroy();
  });

  it("replaceAll does nothing when no matches", () => {
    const editor = createEditor("<p>hello world</p>");
    editor.commands.setSearchQuery("xyz");
    editor.commands.replaceAll("abc");
    expect(editor.state.doc.textContent).toBe("hello world");
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/extensions/__tests__/search-replace.test.ts 2>&1 | tail -5
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement the search-replace extension**

Create `src/extensions/search-replace.ts`:

```ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { findTextMatches, type SearchMatch } from "@/lib/search-utils";

export interface SearchReplaceState {
  query: string;
  caseSensitive: boolean;
  matches: SearchMatch[];
  currentIndex: number;
}

export const searchReplacePluginKey = new PluginKey<SearchReplaceState>(
  "searchReplace"
);

const MATCH_CLASS = "search-match";
const CURRENT_MATCH_CLASS = "search-match-current";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearchQuery: (query: string) => ReturnType;
      findNext: () => ReturnType;
      findPrevious: () => ReturnType;
      replaceCurrent: (replacement: string) => ReturnType;
      replaceAll: (replacement: string) => ReturnType;
      toggleCaseSensitive: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

type SearchReplaceMeta =
  | { type: "setQuery"; query: string }
  | { type: "findNext" }
  | { type: "findPrevious" }
  | { type: "toggleCase" }
  | { type: "clear" };

function recomputeMatches(
  doc: import("@tiptap/pm/model").Node,
  query: string,
  caseSensitive: boolean
): SearchMatch[] {
  return findTextMatches(doc, query, caseSensitive);
}

export const SearchReplace = Extension.create({
  name: "searchReplace",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchReplaceState>({
        key: searchReplacePluginKey,
        state: {
          init(): SearchReplaceState {
            return {
              query: "",
              caseSensitive: false,
              matches: [],
              currentIndex: 0,
            };
          },
          apply(tr, prev): SearchReplaceState {
            const meta = tr.getMeta(searchReplacePluginKey) as
              | SearchReplaceMeta
              | undefined;

            if (!meta) {
              // Doc changed without a search command — recompute matches
              if (tr.docChanged && prev.query) {
                const matches = recomputeMatches(
                  tr.doc,
                  prev.query,
                  prev.caseSensitive
                );
                const currentIndex =
                  matches.length === 0
                    ? 0
                    : Math.min(prev.currentIndex, matches.length - 1);
                return { ...prev, matches, currentIndex };
              }
              return prev;
            }

            switch (meta.type) {
              case "setQuery": {
                const matches = recomputeMatches(
                  tr.doc,
                  meta.query,
                  prev.caseSensitive
                );
                return {
                  ...prev,
                  query: meta.query,
                  matches,
                  currentIndex: 0,
                };
              }
              case "findNext": {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex:
                    (prev.currentIndex + 1) % prev.matches.length,
                };
              }
              case "findPrevious": {
                if (prev.matches.length === 0) return prev;
                return {
                  ...prev,
                  currentIndex:
                    (prev.currentIndex - 1 + prev.matches.length) %
                    prev.matches.length,
                };
              }
              case "toggleCase": {
                const caseSensitive = !prev.caseSensitive;
                const matches = recomputeMatches(
                  tr.doc,
                  prev.query,
                  caseSensitive
                );
                return {
                  ...prev,
                  caseSensitive,
                  matches,
                  currentIndex: 0,
                };
              }
              case "clear": {
                return {
                  query: "",
                  caseSensitive: false,
                  matches: [],
                  currentIndex: 0,
                };
              }
            }
          },
        },
        props: {
          decorations(state) {
            const pluginState = searchReplacePluginKey.getState(state);
            if (!pluginState || pluginState.matches.length === 0) {
              return DecorationSet.empty;
            }

            const decorations = pluginState.matches.map((match, i) =>
              Decoration.inline(match.from, match.to, {
                class:
                  i === pluginState.currentIndex
                    ? CURRENT_MATCH_CLASS
                    : MATCH_CLASS,
              })
            );

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      setSearchQuery:
        (query: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "setQuery",
              query,
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      findNext:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "findNext",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      findPrevious:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "findPrevious",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      replaceCurrent:
        (replacement: string) =>
        ({ editor, tr, dispatch }) => {
          const state = searchReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          const match = state.matches[state.currentIndex];
          if (dispatch) {
            tr.insertText(replacement, match.from, match.to);
            dispatch(tr);
          }
          return true;
        },

      replaceAll:
        (replacement: string) =>
        ({ editor, tr, dispatch }) => {
          const state = searchReplacePluginKey.getState(editor.state);
          if (!state || state.matches.length === 0) return false;

          if (dispatch) {
            // Replace in reverse order to preserve positions
            const sorted = [...state.matches].sort(
              (a, b) => b.from - a.from
            );
            for (const match of sorted) {
              tr.insertText(replacement, match.from, match.to);
            }
            dispatch(tr);
          }
          return true;
        },

      toggleCaseSensitive:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "toggleCase",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.setMeta(searchReplacePluginKey, {
              type: "clear",
            } as SearchReplaceMeta);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        // Handled by React component — this just prevents browser default
        return true;
      },
      "Mod-h": () => {
        // Handled by React component — this just prevents browser default
        return true;
      },
    };
  },
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/extensions/__tests__/search-replace.test.ts 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/extensions/search-replace.ts src/extensions/__tests__/search-replace.test.ts
git commit -m "feat: add SearchReplace Tiptap extension with ProseMirror plugin

Custom extension providing setSearchQuery, findNext, findPrevious,
replaceCurrent, replaceAll, toggleCaseSensitive, and clearSearch commands.
Uses decoration-based match highlighting."
```

---

## Task 3: Search Bar UI Component

**Files:**
- Create: `src/components/__tests__/SearchBar.test.tsx`
- Create: `src/components/SearchBar.tsx`

- [ ] **Step 1: Write failing tests for SearchBar**

Create `src/components/__tests__/SearchBar.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import SearchBar from "../SearchBar";

const defaultProps = {
  query: "",
  matchCount: 0,
  currentIndex: 0,
  caseSensitive: false,
  showReplace: false,
  onQueryChange: vi.fn(),
  onFindNext: vi.fn(),
  onFindPrevious: vi.fn(),
  onReplace: vi.fn(),
  onReplaceAll: vi.fn(),
  onToggleCaseSensitive: vi.fn(),
  onToggleReplace: vi.fn(),
  onClose: vi.fn(),
};

describe("SearchBar", () => {
  it("renders search input", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByPlaceholderText("Find...")).toBeDefined();
  });

  it("displays match count as '0 results' when no matches", () => {
    render(<SearchBar {...defaultProps} query="xyz" />);
    expect(screen.getByText("0 results")).toBeDefined();
  });

  it("displays match count as '1 of 3' with matches", () => {
    render(<SearchBar {...defaultProps} query="hello" matchCount={3} currentIndex={0} />);
    expect(screen.getByText("1 of 3")).toBeDefined();
  });

  it("calls onQueryChange when typing in search input", async () => {
    const onQueryChange = vi.fn();
    render(<SearchBar {...defaultProps} onQueryChange={onQueryChange} />);
    const input = screen.getByPlaceholderText("Find...");
    await userEvent.type(input, "h");
    expect(onQueryChange).toHaveBeenCalledWith("h");
  });

  it("calls onFindNext on Enter key", () => {
    const onFindNext = vi.fn();
    render(<SearchBar {...defaultProps} query="hello" matchCount={2} onFindNext={onFindNext} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFindNext).toHaveBeenCalled();
  });

  it("calls onFindPrevious on Shift+Enter", () => {
    const onFindPrevious = vi.fn();
    render(<SearchBar {...defaultProps} query="hello" matchCount={2} onFindPrevious={onFindPrevious} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(onFindPrevious).toHaveBeenCalled();
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<SearchBar {...defaultProps} onClose={onClose} />);
    const input = screen.getByPlaceholderText("Find...");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows case sensitivity toggle button", () => {
    render(<SearchBar {...defaultProps} />);
    expect(screen.getByTitle("Case sensitive")).toBeDefined();
  });

  it("calls onToggleCaseSensitive when Aa button clicked", async () => {
    const onToggle = vi.fn();
    render(<SearchBar {...defaultProps} onToggleCaseSensitive={onToggle} />);
    await userEvent.click(screen.getByTitle("Case sensitive"));
    expect(onToggle).toHaveBeenCalled();
  });

  it("shows replace row when showReplace is true", () => {
    render(<SearchBar {...defaultProps} showReplace={true} />);
    expect(screen.getByPlaceholderText("Replace...")).toBeDefined();
  });

  it("hides replace row when showReplace is false", () => {
    render(<SearchBar {...defaultProps} showReplace={false} />);
    expect(screen.queryByPlaceholderText("Replace...")).toBeNull();
  });

  it("calls onReplace when Replace button clicked", async () => {
    const onReplace = vi.fn();
    render(<SearchBar {...defaultProps} showReplace={true} query="hello" matchCount={1} onReplace={onReplace} />);
    await userEvent.click(screen.getByTitle("Replace"));
    expect(onReplace).toHaveBeenCalled();
  });

  it("calls onReplaceAll when Replace All button clicked", async () => {
    const onReplaceAll = vi.fn();
    render(<SearchBar {...defaultProps} showReplace={true} query="hello" matchCount={1} onReplaceAll={onReplaceAll} />);
    await userEvent.click(screen.getByTitle("Replace all"));
    expect(onReplaceAll).toHaveBeenCalled();
  });

  it("highlights case sensitive button when active", () => {
    const { container } = render(<SearchBar {...defaultProps} caseSensitive={true} />);
    const btn = screen.getByTitle("Case sensitive");
    expect(btn.className).toContain("bg-");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/SearchBar.test.tsx 2>&1 | tail -5
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement the SearchBar component**

Create `src/components/SearchBar.tsx`:

```tsx
"use client";

import { useRef, useEffect, useState } from "react";

interface SearchBarProps {
  query: string;
  matchCount: number;
  currentIndex: number;
  caseSensitive: boolean;
  showReplace: boolean;
  onQueryChange: (query: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onToggleCaseSensitive: () => void;
  onToggleReplace: () => void;
  onClose: () => void;
}

export default function SearchBar({
  query,
  matchCount,
  currentIndex,
  caseSensitive,
  showReplace,
  onQueryChange,
  onFindNext,
  onFindPrevious,
  onReplace,
  onReplaceAll,
  onToggleCaseSensitive,
  onToggleReplace,
  onClose,
}: SearchBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [replaceValue, setReplaceValue] = useState("");

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onFindPrevious();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onFindNext();
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onReplace(replaceValue);
    }
  };

  const matchDisplay = query
    ? matchCount > 0
      ? `${currentIndex + 1} of ${matchCount}`
      : "0 results"
    : "";

  return (
    <div className="border-b border-gray-200 bg-white px-3 py-2 flex flex-col gap-2">
      {/* Search row */}
      <div className="flex items-center gap-2">
        {/* Expand/collapse replace toggle */}
        <button
          onClick={onToggleReplace}
          title={showReplace ? "Hide replace" : "Show replace"}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`h-3.5 w-3.5 transition-transform ${showReplace ? "rotate-90" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find..."
            className="w-full h-8 pl-3 pr-16 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0075de] focus:border-[#0075de]"
          />
          {matchDisplay && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
              {matchDisplay}
            </span>
          )}
        </div>

        {/* Case sensitive toggle */}
        <button
          onClick={onToggleCaseSensitive}
          title="Case sensitive"
          className={`h-7 w-7 shrink-0 rounded flex items-center justify-center text-xs font-bold transition-colors ${
            caseSensitive
              ? "bg-[#0075de]/10 text-[#0075de]"
              : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          }`}
        >
          Aa
        </button>

        {/* Navigate matches */}
        <button
          onClick={onFindPrevious}
          title="Previous match"
          disabled={matchCount === 0}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onFindNext}
          title="Next match"
          disabled={matchCount === 0}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close"
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-2 pl-9">
          <input
            type="text"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace..."
            className="flex-1 max-w-sm h-8 pl-3 pr-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0075de] focus:border-[#0075de]"
          />
          <button
            onClick={() => onReplace(replaceValue)}
            title="Replace"
            disabled={matchCount === 0}
            className="h-7 px-2 shrink-0 rounded text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors border border-gray-300"
          >
            Replace
          </button>
          <button
            onClick={() => onReplaceAll(replaceValue)}
            title="Replace all"
            disabled={matchCount === 0}
            className="h-7 px-2 shrink-0 rounded text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-default transition-colors border border-gray-300"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/SearchBar.test.tsx 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/SearchBar.tsx src/components/__tests__/SearchBar.test.tsx
git commit -m "feat: add SearchBar component for find and replace UI

Floating bar with search input, match counter, navigation arrows,
case sensitivity toggle, and expandable replace row."
```

---

## Task 4: CSS Styles for Search Highlights

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add search highlight styles**

Append the following to `src/app/globals.css`:

```css
/* Find & Replace highlights */
.search-match {
  background-color: #fde68a; /* yellow-200 */
  border-radius: 2px;
}

.search-match-current {
  background-color: #fb923c; /* orange-400 */
  border-radius: 2px;
  box-shadow: 0 0 0 1px #ea580c; /* orange-600 ring */
}
```

- [ ] **Step 2: Verify the file saved correctly**

```bash
cd /Users/ronica/projects/markdown-collab
grep "search-match" src/app/globals.css
```

Expected: both `.search-match` and `.search-match-current` lines appear.

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/app/globals.css
git commit -m "style: add CSS classes for search match highlighting

Yellow for all matches, orange with ring for current match."
```

---

## Task 5: Keyboard Shortcut Registration

**Files:**
- Modify: `src/extensions/search-replace.ts` (already has placeholder shortcuts from Task 2)
- Modify: `src/components/Editor.tsx` (keyboard event handling)

The Tiptap extension's `addKeyboardShortcuts()` in Task 2 already captures `Mod-f` and `Mod-h` to prevent browser defaults. In this task we wire the actual React-level event handling so those shortcuts open the search bar.

- [ ] **Step 1: Add a global keydown listener in Editor.tsx for Cmd+F and Cmd+H**

In `src/components/Editor.tsx`, add state and an effect for the keyboard shortcuts. The implementation is done in Task 6 (Editor Integration) since it requires the SearchBar to be rendered. This task verifies the Tiptap shortcuts suppress the browser default.

Verify the extension's keyboard shortcuts are registered:

```bash
cd /Users/ronica/projects/markdown-collab
grep -A 10 "addKeyboardShortcuts" src/extensions/search-replace.ts
```

Expected: `Mod-f` and `Mod-h` entries are present.

- [ ] **Step 2: Commit**

No separate commit needed — shortcuts are already part of the extension from Task 2. The React-level wiring happens in Task 6.

---

## Task 6: Editor Integration

**Files:**
- Modify: `src/components/Editor.tsx`

- [ ] **Step 1: Add SearchReplace extension and SearchBar to Editor.tsx**

Apply the following changes to `src/components/Editor.tsx`:

**Add imports at the top:**

```ts
import { SearchReplace, searchReplacePluginKey } from "@/extensions/search-replace";
import SearchBar from "./SearchBar";
```

**Add search state after the existing `useState` calls (around line 63):**

```ts
const [searchOpen, setSearchOpen] = useState(false);
const [showReplace, setShowReplace] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
```

**Add the SearchReplace extension to the extensions array (after `CommentMark`):**

```ts
SearchReplace,
```

**Add a `useEffect` for the global keyboard shortcut listener (after the existing `useEffect` blocks):**

```ts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "f") {
      e.preventDefault();
      setSearchOpen(true);
      setShowReplace(false);
    } else if (mod && e.key === "h") {
      e.preventDefault();
      setSearchOpen(true);
      setShowReplace(true);
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, []);
```

**Add helper functions before the `return` statement:**

```ts
const searchState = editor
  ? searchReplacePluginKey.getState(editor.state)
  : null;

const handleQueryChange = (query: string) => {
  setSearchQuery(query);
  editor?.commands.setSearchQuery(query);
};

const handleClose = () => {
  setSearchOpen(false);
  setSearchQuery("");
  editor?.commands.clearSearch();
  editor?.commands.focus();
};
```

**Add the SearchBar component in the JSX, right after the opening `<div className="flex-1 ...">` and before `<EditorContent>`:**

```tsx
{searchOpen && editor && (
  <SearchBar
    query={searchQuery}
    matchCount={searchState?.matches.length ?? 0}
    currentIndex={searchState?.currentIndex ?? 0}
    caseSensitive={searchState?.caseSensitive ?? false}
    showReplace={showReplace}
    onQueryChange={handleQueryChange}
    onFindNext={() => editor.commands.findNext()}
    onFindPrevious={() => editor.commands.findPrevious()}
    onReplace={(replacement) => editor.commands.replaceCurrent(replacement)}
    onReplaceAll={(replacement) => editor.commands.replaceAll(replacement)}
    onToggleCaseSensitive={() => editor.commands.toggleCaseSensitive()}
    onToggleReplace={() => setShowReplace((v) => !v)}
    onClose={handleClose}
  />
)}
```

- [ ] **Step 2: Ensure editor state re-renders on search state changes**

Add an `onTransaction` callback to the `useEditor` config to trigger re-renders when search state changes. Add this after the `onSelectionUpdate` callback:

```ts
onTransaction() {
  // Force re-render so SearchBar picks up latest match count/index
  // from the ProseMirror plugin state. The useEditor hook already
  // triggers re-renders on transactions, so this is a no-op callback
  // ensuring the hook is aware we depend on transaction updates.
},
```

- [ ] **Step 3: Verify the dev server starts without errors**

```bash
cd /Users/ronica/projects/markdown-collab
npx next build 2>&1 | tail -10
```

Expected: build completes without TypeScript or import errors.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/Editor.tsx
git commit -m "feat: integrate find-and-replace into editor

Wire SearchReplace extension and SearchBar component into Editor.tsx.
Cmd+F opens search, Cmd+H opens search+replace. Escape closes."
```

---

## Task 7: Toolbar Find Button

**Files:**
- Modify: `src/components/Toolbar.tsx`
- Modify: `src/components/Editor.tsx` (pass search toggle callback)

- [ ] **Step 1: Add onOpenSearch prop to Toolbar**

In `src/components/Toolbar.tsx`, update the `ToolbarProps` interface:

```ts
interface ToolbarProps {
  editor: Editor | null;
  onOpenSearch?: () => void;
}
```

Update the component signature:

```ts
export default function Toolbar({ editor, onOpenSearch }: ToolbarProps) {
```

Add a search button at the end of the `buttons` array, before the closing `]`:

```ts
{
  label: "Find & Replace",
  shortcut: "Mod+F",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  ),
  action: () => onOpenSearch?.(),
  isActive: () => false,
  separator: true,
},
```

- [ ] **Step 2: Update Editor.tsx to pass onOpenSearch to Toolbar**

In whichever parent component renders `<Toolbar>`, pass the callback. If `Toolbar` is rendered from `page.tsx` or another parent, find that file and add the prop. If Toolbar is rendered alongside Editor, add:

```tsx
<Toolbar editor={editor} onOpenSearch={() => { setSearchOpen(true); setShowReplace(false); }} />
```

Note: Check the actual parent that renders Toolbar. If it is rendered from `src/app/doc/[id]/page.tsx`, the `searchOpen` state and `setSearchOpen` need to be lifted up or the Toolbar needs to dispatch a DOM event. The simplest approach: since Editor.tsx already listens for `Cmd+F` via a global keydown handler, the Toolbar button can programmatically dispatch a keyboard event:

```ts
action: () => {
  // Dispatch synthetic Cmd+F to trigger the global handler in Editor
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true }));
},
```

This avoids prop-threading through page.tsx.

- [ ] **Step 3: Verify the toolbar renders the search button**

```bash
cd /Users/ronica/projects/markdown-collab
npx next build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/Toolbar.tsx src/components/Editor.tsx
git commit -m "feat: add Find & Replace button to toolbar

Search icon in toolbar triggers Cmd+F handler to open the search bar."
```

---

## Task 8: Manual QA Checklist

No code changes. Run these checks manually in the browser at http://100.109.228.117:3000/.

- [ ] **Step 1: Open a document and press Cmd+F. Verify the search bar appears below the toolbar.**
- [ ] **Step 2: Type a word that appears multiple times. Verify yellow highlights appear on all matches and orange on the current match.**
- [ ] **Step 3: Press Enter to advance to the next match. Verify the orange highlight moves.**
- [ ] **Step 4: Press Shift+Enter to go to the previous match. Verify it wraps correctly.**
- [ ] **Step 5: Click the "Aa" button. Verify case-sensitive mode changes match results.**
- [ ] **Step 6: Press Cmd+H. Verify the replace row appears.**
- [ ] **Step 7: Type a replacement and click "Replace". Verify only the current match is replaced.**
- [ ] **Step 8: Click "All". Verify all remaining matches are replaced.**
- [ ] **Step 9: Press Escape. Verify the search bar closes and highlights are removed.**
- [ ] **Step 10: Open a second browser tab to the same document. Perform a search in tab 1 and verify tab 2 does NOT see search highlights (local-only state).**
- [ ] **Step 11: In tab 1, replace text. Verify tab 2 receives the text change via Yjs sync.**

---

## Summary

| Task | Estimated Time | Files |
|---|---|---|
| 1. Search utility functions | 5 min | `src/lib/search-utils.ts`, `src/lib/__tests__/search-utils.test.ts` |
| 2. Tiptap extension | 5 min | `src/extensions/search-replace.ts`, `src/extensions/__tests__/search-replace.test.ts` |
| 3. SearchBar UI | 5 min | `src/components/SearchBar.tsx`, `src/components/__tests__/SearchBar.test.tsx` |
| 4. CSS highlights | 2 min | `src/app/globals.css` |
| 5. Keyboard shortcuts | 1 min | (verified in Task 2) |
| 6. Editor integration | 5 min | `src/components/Editor.tsx` |
| 7. Toolbar button | 3 min | `src/components/Toolbar.tsx` |
| 8. Manual QA | 5 min | (browser testing) |
| **Total** | **~31 min** | |

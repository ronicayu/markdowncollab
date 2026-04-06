# Keyboard Shortcuts Help Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add a keyboard shortcuts help dialog showing all editor shortcuts, triggered by Cmd+/ or toolbar button.

**Architecture:** Simple modal component with categorized shortcut table. Platform-aware (Cmd vs Ctrl). Triggered via Tiptap keyboard shortcut and toolbar button.

**Tech Stack:** React, Tailwind

---

## File Map

| File | Change |
|---|---|
| `src/components/KeyboardShortcutsDialog.tsx` | New — modal dialog with categorized shortcut tables |
| `src/components/__tests__/KeyboardShortcutsDialog.test.tsx` | New — unit tests for dialog rendering, platform detection, open/close |
| `src/components/Toolbar.tsx` | Add `?` help button at right end of toolbar |
| `src/components/Editor.tsx` | Add state + keyboard shortcut registration for Cmd+/ |

---

## Task 1: Shortcut Data Definition and Dialog Component

**Files:**
- Create: `src/components/KeyboardShortcutsDialog.tsx`
- Create: `src/components/__tests__/KeyboardShortcutsDialog.test.tsx`

- [ ] **Step 1: Write failing tests for the dialog**

Create `src/components/__tests__/KeyboardShortcutsDialog.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import KeyboardShortcutsDialog from "../KeyboardShortcutsDialog";

describe("KeyboardShortcutsDialog", () => {
  it("does not render when open is false", () => {
    const { container } = render(
      <KeyboardShortcutsDialog open={false} onClose={vi.fn()} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders dialog with heading when open is true", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Keyboard Shortcuts")).toBeDefined();
  });

  it("renders all shortcut categories", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Text Formatting")).toBeDefined();
    expect(screen.getByText("Blocks")).toBeDefined();
    expect(screen.getByText("Editing")).toBeDefined();
    expect(screen.getByText("Navigation")).toBeDefined();
  });

  it("renders shortcut actions like Bold, Italic, Undo", () => {
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Bold")).toBeDefined();
    expect(screen.getByText("Italic")).toBeDefined();
    expect(screen.getByText("Undo")).toBeDefined();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("shortcuts-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<KeyboardShortcutsDialog open={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Ctrl on non-Mac platforms", () => {
    // jsdom defaults to empty userAgent/platform, which is non-Mac
    render(<KeyboardShortcutsDialog open={true} onClose={vi.fn()} />);
    const allText = document.body.textContent || "";
    expect(allText).toContain("Ctrl");
  });
});
```

Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/KeyboardShortcutsDialog.test.tsx --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 2: Implement the KeyboardShortcutsDialog component**

Create `src/components/KeyboardShortcutsDialog.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface ShortcutEntry {
  keys: string; // Uses "Mod" as placeholder for Cmd/Ctrl
  action: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_DATA: ShortcutCategory[] = [
  {
    title: "Text Formatting",
    shortcuts: [
      { keys: "Mod+B", action: "Bold" },
      { keys: "Mod+I", action: "Italic" },
      { keys: "Mod+U", action: "Underline" },
      { keys: "Mod+E", action: "Inline code" },
      { keys: "Mod+Shift+X", action: "Strikethrough" },
    ],
  },
  {
    title: "Blocks",
    shortcuts: [
      { keys: "Mod+Alt+1", action: "Heading 1" },
      { keys: "Mod+Alt+2", action: "Heading 2" },
      { keys: "Mod+Alt+3", action: "Heading 3" },
      { keys: "Mod+Alt+4", action: "Heading 4" },
      { keys: "Mod+Alt+5", action: "Heading 5" },
      { keys: "Mod+Alt+6", action: "Heading 6" },
      { keys: "Mod+Shift+7", action: "Ordered list" },
      { keys: "Mod+Shift+8", action: "Bullet list" },
      { keys: "Mod+Shift+9", action: "Blockquote" },
      { keys: "Mod+Alt+C", action: "Code block" },
      { keys: "/", action: "Slash command menu" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "Mod+F", action: "Find" },
      { keys: "Mod+H", action: "Find & Replace" },
      { keys: "Mod+Z", action: "Undo" },
      { keys: "Mod+Shift+Z", action: "Redo" },
      { keys: "Tab", action: "Indent list" },
      { keys: "Shift+Tab", action: "Outdent list" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Mod+/", action: "Show this help" },
      { keys: "Escape", action: "Close dialog / search" },
    ],
  },
];

function formatKey(key: string, isMac: boolean): string {
  return key
    .replace(/Mod/g, isMac ? "\u2318" : "Ctrl")
    .replace(/Alt/g, isMac ? "\u2325" : "Alt")
    .replace(/Shift/g, isMac ? "\u21E7" : "Shift");
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="shortcuts-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl mx-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_DATA.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-700">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {formatKey(shortcut.keys, isMac)
                        .split("+")
                        .map((part, i) => (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md"
                          >
                            {part}
                          </kbd>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run tests (expect all pass)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/KeyboardShortcutsDialog.test.tsx --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/KeyboardShortcutsDialog.tsx src/components/__tests__/KeyboardShortcutsDialog.test.tsx
git commit -m "feat: add keyboard shortcuts help dialog component with tests"
```

---

## Task 2: Register Cmd+/ Keyboard Shortcut in Editor

**Files:**
- Modify: `src/components/Editor.tsx`

- [ ] **Step 1: Add shortcutsOpen state and pass it up via callback**

In `src/components/Editor.tsx`, add a new prop `onToggleShortcutsHelp` and state to the `EditorProps` interface and component. The keyboard shortcut will be handled at the page level since the dialog renders outside the editor.

Edit `src/components/Editor.tsx` — update the `EditorProps` interface to add:

```typescript
interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  onEditorReady?: (editor: TiptapEditor) => void;
  activeCommentId?: string | null;
  onToggleShortcutsHelp?: () => void;
}
```

Update the destructured props:

```typescript
export default function Editor({
  documentId: _documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  onToggleShortcutsHelp,
}: EditorProps) {
```

- [ ] **Step 2: Register the Mod-/ keyboard shortcut via a global keydown listener**

Add a `useEffect` in `Editor.tsx` that listens for `Cmd+/` (or `Ctrl+/`) and calls `onToggleShortcutsHelp`:

```typescript
// Register Cmd+/ (Ctrl+/ on non-Mac) to toggle shortcuts help
useEffect(() => {
  if (!onToggleShortcutsHelp) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.preventDefault();
      onToggleShortcutsHelp();
    }
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [onToggleShortcutsHelp]);
```

Place this `useEffect` after the existing `useEffect` blocks, before the `useEditor` call.

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/Editor.tsx
git commit -m "feat: register Cmd+/ keyboard shortcut for shortcuts help in Editor"
```

---

## Task 3: Add Help Button to Toolbar

**Files:**
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Add onToggleShortcutsHelp prop to Toolbar**

In `src/components/Toolbar.tsx`, update the `ToolbarProps` interface:

```typescript
interface ToolbarProps {
  editor: Editor | null;
  onToggleShortcutsHelp?: () => void;
}
```

Update the component signature:

```typescript
export default function Toolbar({ editor, onToggleShortcutsHelp }: ToolbarProps) {
```

- [ ] **Step 2: Add the `?` button at the end of the toolbar**

In the return JSX of `Toolbar`, add a `?` button after the `buttons.map(...)` block but still inside the flex container `<div>`. Place it right before the closing `</div>` of the button row:

```tsx
{/* Separator before help button */}
<div className="w-px h-5 bg-gray-200 mx-1.5" />
<button
  onClick={onToggleShortcutsHelp}
  title={`Keyboard shortcuts (${isMac ? "\u2318" : "Ctrl"}+/)`}
  className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
    <circle cx="12" cy="12" r="10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
  </svg>
</button>
```

The insertion point is after the closing `)}` of `buttons.map(...)` and before `</div>`:

Find this in the current code:
```tsx
      ))}
    </div>
```

Replace with:
```tsx
      ))}
      {/* Separator before help button */}
      <div className="w-px h-5 bg-gray-200 mx-1.5" />
      <button
        onClick={onToggleShortcutsHelp}
        title={`Keyboard shortcuts (${isMac ? "\u2318" : "Ctrl"}+/)`}
        className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      </button>
    </div>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/Toolbar.tsx
git commit -m "feat: add keyboard shortcuts help button to toolbar"
```

---

## Task 4: Wire Everything Together in the Document Page

**Files:**
- Modify: `src/app/doc/[id]/page.tsx`

- [ ] **Step 1: Add shortcutsOpen state and import dialog**

At the top of `src/app/doc/[id]/page.tsx`, add the import:

```typescript
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
```

Inside the component body, add state:

```typescript
const [shortcutsOpen, setShortcutsOpen] = useState(false);
const toggleShortcutsHelp = useCallback(() => setShortcutsOpen((prev) => !prev), []);
```

- [ ] **Step 2: Pass the callback to Editor and Toolbar**

Find where `<Toolbar editor={editorRef.current} />` is rendered and change to:

```tsx
<Toolbar editor={editorRef.current} onToggleShortcutsHelp={toggleShortcutsHelp} />
```

Find where `<Editor ... />` is rendered and add the prop:

```tsx
<Editor
  ...existing props...
  onToggleShortcutsHelp={toggleShortcutsHelp}
/>
```

- [ ] **Step 3: Render the dialog**

Add the dialog at the end of the component's return JSX, just before the final closing `</div>` or fragment:

```tsx
<KeyboardShortcutsDialog
  open={shortcutsOpen}
  onClose={() => setShortcutsOpen(false)}
/>
```

- [ ] **Step 4: Verify manually**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/app/doc/[id]/page.tsx
git commit -m "feat: wire keyboard shortcuts dialog into document page"
```

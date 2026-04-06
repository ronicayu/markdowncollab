# Collaboration Cursors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Enable real-time collaboration cursors showing where other users are editing with colored carets and name labels.

**Architecture:** Integrate @tiptap/extension-collaboration-cursor with Yjs awareness. Color assignment by name hash. Cursor rendering via CSS.

**Tech Stack:** @tiptap/extension-collaboration-cursor, Yjs awareness, CSS

---

## File Map

| File | Change |
|---|---|
| `src/lib/cursor-utils.ts` | New -- getUserColor() function for deterministic color from name hash |
| `src/lib/__tests__/cursor-utils.test.ts` | New -- unit tests for color assignment |
| `src/components/Editor.tsx` | Modified -- add CollaborationCursor extension with provider and user info |
| `src/app/doc/[id]/page.tsx` | Modified -- pass provider to Editor, use deterministic color, remove duplicate awareness set |
| `src/app/globals.css` | Modified -- update collaboration cursor styles for colored carets and labels |

---

## Task 1: Cursor Color Utility -- Tests First

**Files:**
- Create: `src/lib/__tests__/cursor-utils.test.ts`
- Create: `src/lib/cursor-utils.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/__tests__/cursor-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getUserColor, CURSOR_COLORS } from "../cursor-utils";

describe("getUserColor", () => {
  it("returns a color from the CURSOR_COLORS array", () => {
    const color = getUserColor("Alice");
    expect(CURSOR_COLORS).toContain(color);
  });

  it("returns the same color for the same name", () => {
    const color1 = getUserColor("Bob");
    const color2 = getUserColor("Bob");
    expect(color1).toBe(color2);
  });

  it("returns different colors for different names", () => {
    // With 10 colors and carefully chosen names, most should differ
    const colors = new Set([
      getUserColor("Alice"),
      getUserColor("Bob"),
      getUserColor("Charlie"),
      getUserColor("Diana"),
      getUserColor("Eve"),
    ]);
    // At least 3 of 5 should be distinct (probabilistic but reliable with these names)
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it("handles empty string without crashing", () => {
    const color = getUserColor("");
    expect(CURSOR_COLORS).toContain(color);
  });

  it("handles unicode names", () => {
    const color = getUserColor("佐藤太郎");
    expect(CURSOR_COLORS).toContain(color);
  });
});
```

- [ ] **Step 2: Create the cursor-utils module**

Create `src/lib/cursor-utils.ts`:

```ts
export const CURSOR_COLORS = [
  "#f97316", // orange
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#22c55e", // green
  "#ec4899", // pink
  "#f59e0b", // amber
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#e11d48", // rose
];

/**
 * Assign a consistent color to a user based on a hash of their name.
 * Same name always gets the same color.
 */
export function getUserColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
```

- [ ] **Step 3: Run the tests -- they should pass**

```bash
npx vitest run src/lib/__tests__/cursor-utils.test.ts
```

All 5 tests should pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cursor-utils.ts src/lib/__tests__/cursor-utils.test.ts
git commit -m "feat: add getUserColor utility for deterministic cursor colors"
```

---

## Task 2: Update CSS for Collaboration Cursors

**Files:**
- Modified: `src/app/globals.css`

- [ ] **Step 1: Replace existing cursor styles**

In `src/app/globals.css`, replace the existing `.collaboration-cursor__caret` block (lines 30-38):

```css
/* Collaboration cursors */
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}
```

with this updated version:

```css
/* Collaboration cursors */
.collaboration-cursor__caret {
  position: relative;
  border-left: 2px solid;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  word-break: normal;
}
```

- [ ] **Step 2: Update the label styles**

Replace the existing `.collaboration-cursor__label` block (lines 84-97):

```css
.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 1px 6px;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}
```

with this updated version:

```css
.collaboration-cursor__label {
  position: absolute;
  top: -1.4em;
  left: -1px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  padding: 1px 6px;
  border-radius: 3px 3px 3px 0;
  color: white;
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update collaboration cursor CSS for colored carets and labels"
```

---

## Task 3: Integrate CollaborationCursor Extension in Editor

**Files:**
- Modified: `src/components/Editor.tsx`

- [ ] **Step 1: Add CollaborationCursor import**

In `src/components/Editor.tsx`, add this import after the existing Collaboration import (after line 6):

```ts
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
```

Also add the import for `getUserColor`:

```ts
import { getUserColor } from "@/lib/cursor-utils";
```

- [ ] **Step 2: Remove the old CURSOR_COLORS array and getRandomColor function**

Remove lines 20-35 (the `CURSOR_COLORS` array and `getRandomColor` function) since we now use the shared `getUserColor` utility.

- [ ] **Step 3: Update cursorColor to use deterministic getUserColor**

Replace the line:

```ts
  const cursorColor = useMemo(() => getRandomColor(), []);
```

with:

```ts
  const cursorColor = useMemo(() => getUserColor(userName), [userName]);
```

- [ ] **Step 4: Add CollaborationCursor to the extensions array**

In the `useEditor` call, replace the comment `// Cursor plugin disabled -- see comment above` with the actual extension:

```ts
      CollaborationCursor.configure({
        provider,
        user: {
          name: userName,
          color: cursorColor,
        },
      }),
```

- [ ] **Step 5: Remove the disabled cursor comment at the top of the file**

Remove the comment block at lines 7-8 and lines 37-40:

```ts
// yCursorPlugin disabled — see note below
```

and:

```ts
// yCursorPlugin crashes in y-prosemirror 1.x with Tiptap v3 because
// awareness.doc is undefined during createDecorations. We set awareness
// user info so collaborator avatars in TopBar work, but skip the cursor
// rendering plugin until y-prosemirror ships a compatible version.
```

- [ ] **Step 6: Update the EditorProps interface to include provider**

The `provider` prop is already in the `EditorProps` interface (line 46: `provider: WebsocketProvider;`). No change needed.

- [ ] **Step 7: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: enable CollaborationCursor extension with deterministic colors"
```

---

## Task 4: Update Document Page for Deterministic Colors

**Files:**
- Modified: `src/app/doc/[id]/page.tsx`

- [ ] **Step 1: Import getUserColor**

In `src/app/doc/[id]/page.tsx`, add this import after the existing imports:

```ts
import { getUserColor } from "@/lib/cursor-utils";
```

- [ ] **Step 2: Replace the random color in the awareness useEffect**

Find the useEffect that sets awareness user info (around line 223-226):

```ts
  useEffect(() => {
    if (!userName) return;
    const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
    provider.awareness.setLocalStateField("user", { name: userName, color });
  }, [provider, userName]);
```

Replace it with:

```ts
  useEffect(() => {
    if (!userName) return;
    const color = getUserColor(userName);
    provider.awareness.setLocalStateField("user", { name: userName, color });
  }, [provider, userName]);
```

- [ ] **Step 3: Commit**

```bash
git add src/app/doc/[id]/page.tsx
git commit -m "feat: use deterministic cursor color in document page awareness"
```

---

## Task 5: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the same document in two browser tabs/windows**

Open http://100.109.228.117:3000/ in two separate browser tabs (or one regular and one incognito). Each will get a different random animal name and a deterministic color.

- [ ] **Step 3: Verify cursor rendering**

1. In tab 1, click somewhere in the document text
2. In tab 2, observe a colored caret with a name label appearing at the position where tab 1's cursor is
3. Move the cursor in tab 1 -- the remote cursor in tab 2 should follow in real time
4. Type text in tab 1 -- tab 2 should show the cursor moving as text is inserted

- [ ] **Step 4: Verify color consistency**

1. Note the cursor color for a user name
2. Refresh the page -- the same name should get the same color
3. Open a different document -- the same name should still get the same color

- [ ] **Step 5: Verify label visibility**

1. The name label should appear above the cursor caret
2. The label background should match the caret color
3. The label text should be white and readable
4. The label should not interfere with text selection or typing

- [ ] **Step 6: Run the full test suite**

```bash
npm run test
```

Ensure no regressions.

- [ ] **Step 7: Final commit if any fixups needed**

```bash
git add -A
git commit -m "feat: collaboration cursors -- colored carets with name labels"
```

---

## Verification Checklist

- [ ] `getUserColor` returns consistent colors for the same name
- [ ] CollaborationCursor extension is registered without console errors
- [ ] Remote cursors appear as colored carets with name labels
- [ ] Cursor positions update in real time as users type and navigate
- [ ] Cursor colors are visually distinct between users
- [ ] Labels are readable (white text on colored background)
- [ ] Labels disappear when the remote user disconnects
- [ ] Awareness state shows user names in the TopBar collaborator list
- [ ] No y-prosemirror compatibility errors in the console
- [ ] All existing tests pass (no regressions)
- [ ] Cursor utility tests pass

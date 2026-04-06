# Table Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add table editing support with slash command, toolbar button, and markdown export.

**Architecture:** Use @tiptap/extension-table ecosystem. Add /table slash command and toolbar button. Extend export-markdown.ts for pipe-delimited table output.

**Tech Stack:** @tiptap/extension-table, React, Tailwind

---

## File Map

| File | Change |
|---|---|
| `package.json` | Modified -- add @tiptap/extension-table, @tiptap/extension-table-row, @tiptap/extension-table-cell, @tiptap/extension-table-header |
| `src/components/Editor.tsx` | Modified -- register four table extensions |
| `src/components/SlashCommandMenu.tsx` | Modified -- add /table command |
| `src/components/Toolbar.tsx` | Modified -- add table button after horizontal rule |
| `src/app/globals.css` | Modified -- add table styles |
| `src/lib/export-markdown.ts` | Modified -- handle table/tableRow/tableHeader/tableCell nodes |
| `server/combined-server.mjs` | Modified -- handle table nodes in server-side markdown export |
| `src/lib/__tests__/export-markdown-tables.test.ts` | New -- unit tests for table markdown export |

---

## Task 1: Install Table Extension Packages

**Files:**
- Modified: `package.json`

- [ ] **Step 1: Install the four table extension packages**

Run this command from the project root:

```bash
npm install @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
```

Verify the packages are added to `package.json` dependencies. Ensure no peer dependency warnings.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @tiptap/extension-table packages"
```

---

## Task 2: Register Table Extensions in Editor

**Files:**
- Modified: `src/components/Editor.tsx`

- [ ] **Step 1: Add imports at the top of Editor.tsx**

Add these imports after the existing extension imports (after the `SearchReplace` import on line 17):

```ts
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
```

- [ ] **Step 2: Add extensions to the editor's extensions array**

In the `useEditor` call, add the four table extensions to the `extensions` array. Insert them after the `Markdown` extension configuration (after line 131) and before the cursor plugin comment:

```ts
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: "editor-table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
```

- [ ] **Step 3: Verify the editor still loads**

Run the dev server and open a document. Confirm no console errors related to table extensions.

```bash
npm run dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: register table extensions in Editor"
```

---

## Task 3: Add Table CSS Styles

**Files:**
- Modified: `src/app/globals.css`

- [ ] **Step 1: Add table styles to globals.css**

Add these styles after the `.ProseMirror hr` rule (after the line `.ProseMirror hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }`):

```css
/* Table styles */
.ProseMirror .editor-table {
  border-collapse: collapse;
  width: 100%;
  margin: 1rem 0;
  overflow-x: auto;
}
.ProseMirror .editor-table td,
.ProseMirror .editor-table th {
  border: 1px solid #d4a574;
  padding: 0.5rem;
  min-width: 80px;
  vertical-align: top;
}
.ProseMirror .editor-table th {
  background-color: rgba(180, 120, 60, 0.1);
  font-weight: 600;
}
.ProseMirror .editor-table .selectedCell {
  background-color: rgba(180, 120, 60, 0.15);
}
.ProseMirror .editor-table p {
  margin-bottom: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add table CSS styles"
```

---

## Task 4: Add /table Slash Command

**Files:**
- Modified: `src/components/SlashCommandMenu.tsx`

- [ ] **Step 1: Add table command to the COMMANDS array**

In `src/components/SlashCommandMenu.tsx`, add a new command entry to the `COMMANDS` array. Insert it after the `divider` command (the last entry, before the closing `]`):

```ts
  {
    id: "table",
    label: "Table",
    description: "Insert a 3x3 table",
    icon: "▦",
    keywords: ["table", "grid", "spreadsheet"],
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
```

- [ ] **Step 2: Test the slash command**

Run the dev server, open a document, type `/table`, verify the command appears in the menu, select it, and confirm a 3x3 table with a header row is inserted.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlashCommandMenu.tsx
git commit -m "feat: add /table slash command"
```

---

## Task 5: Add Table Toolbar Button

**Files:**
- Modified: `src/components/Toolbar.tsx`

- [ ] **Step 1: Add table button to the toolbar buttons array**

In `src/components/Toolbar.tsx`, add a new button entry to the `buttons` array. Insert it after the horizontal rule button (after the object with `label: "Horizontal rule"`) and before the Find & Replace button:

```ts
    {
      label: "Table",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path strokeLinecap="round" d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      ),
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      isActive: () => editor.isActive("table"),
      separator: true,
    },
```

- [ ] **Step 2: Test the toolbar button**

Run the dev server, verify the table icon appears in the toolbar, click it, confirm a 3x3 table is inserted.

- [ ] **Step 3: Commit**

```bash
git add src/components/Toolbar.tsx
git commit -m "feat: add table button to toolbar"
```

---

## Task 6: Table Markdown Export -- Tests First

**Files:**
- Create: `src/lib/__tests__/export-markdown-tables.test.ts`

- [ ] **Step 1: Create the test file with table export tests**

Create `src/lib/__tests__/export-markdown-tables.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { xmlFragmentToMarkdown } from "../export-markdown";

/**
 * Helper: build a Yjs document with a table structure.
 * Tiptap tables use these node names: table, tableRow, tableHeader, tableCell.
 * Each cell contains a paragraph with text.
 */
function createTableDoc(headers: string[], rows: string[][]): Y.Doc {
  const doc = new Y.Doc();
  const fragment = doc.getXmlFragment("default");

  const table = new Y.XmlElement("table");

  // Header row
  const headerRow = new Y.XmlElement("tableRow");
  for (const header of headers) {
    const th = new Y.XmlElement("tableHeader");
    const p = new Y.XmlElement("paragraph");
    const text = new Y.XmlText();
    text.insert(0, header);
    p.insert(0, [text]);
    th.insert(0, [p]);
    headerRow.push([th]);
  }
  table.push([headerRow]);

  // Data rows
  for (const row of rows) {
    const tr = new Y.XmlElement("tableRow");
    for (const cell of row) {
      const td = new Y.XmlElement("tableCell");
      const p = new Y.XmlElement("paragraph");
      const text = new Y.XmlText();
      text.insert(0, cell);
      p.insert(0, [text]);
      td.insert(0, [p]);
      tr.push([td]);
    }
    table.push([tr]);
  }

  fragment.push([table]);
  return doc;
}

describe("xmlFragmentToMarkdown - table support", () => {
  it("exports a simple 2-column table with header", () => {
    const doc = createTableDoc(
      ["Name", "Age"],
      [
        ["Alice", "30"],
        ["Bob", "25"],
      ]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| Name | Age |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| Alice | 30 |");
    expect(md).toContain("| Bob | 25 |");
  });

  it("exports a single-row table (header only)", () => {
    const doc = createTableDoc(["Col A", "Col B"], []);
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| Col A | Col B |");
    expect(md).toContain("| --- | --- |");
  });

  it("handles empty cell content", () => {
    const doc = createTableDoc(
      ["X", "Y"],
      [["", "data"]]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("|  | data |");
  });

  it("handles a 3-column table", () => {
    const doc = createTableDoc(
      ["A", "B", "C"],
      [["1", "2", "3"]]
    );
    const md = xmlFragmentToMarkdown(doc.getXmlFragment("default"));
    expect(md).toContain("| A | B | C |");
    expect(md).toContain("| --- | --- | --- |");
    expect(md).toContain("| 1 | 2 | 3 |");
  });

  it("exports table with bold text in cells", () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment("default");
    const table = new Y.XmlElement("table");
    const headerRow = new Y.XmlElement("tableRow");
    const th = new Y.XmlElement("tableHeader");
    const p1 = new Y.XmlElement("paragraph");
    const t1 = new Y.XmlText();
    t1.insert(0, "Header", { bold: true });
    p1.insert(0, [t1]);
    th.insert(0, [p1]);
    headerRow.push([th]);
    table.push([headerRow]);

    const dataRow = new Y.XmlElement("tableRow");
    const td = new Y.XmlElement("tableCell");
    const p2 = new Y.XmlElement("paragraph");
    const t2 = new Y.XmlText();
    t2.insert(0, "Normal");
    p2.insert(0, [t2]);
    td.insert(0, [p2]);
    dataRow.push([td]);
    table.push([dataRow]);

    fragment.push([table]);

    const md = xmlFragmentToMarkdown(fragment);
    expect(md).toContain("| **Header** |");
    expect(md).toContain("| Normal |");
  });
});
```

- [ ] **Step 2: Run the tests -- they should fail**

```bash
npx vitest run src/lib/__tests__/export-markdown-tables.test.ts
```

All tests should fail because `xmlFragmentToMarkdown` does not yet handle table nodes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/__tests__/export-markdown-tables.test.ts
git commit -m "test: add failing tests for table markdown export"
```

---

## Task 7: Table Markdown Export -- Implementation

**Files:**
- Modified: `src/lib/export-markdown.ts`

- [ ] **Step 1: Add table export logic to xmlFragmentToMarkdown**

In `src/lib/export-markdown.ts`, in the `xmlFragmentToMarkdown` function, add a new `else if` branch for the `"table"` tag. Insert it after the `horizontalRule` branch (after line 46 `md += "---\n\n";`) and before the `else` fallback:

```ts
      } else if (tag === "table") {
        md += tableToMarkdown(child);
        md += "\n";
```

- [ ] **Step 2: Add the tableToMarkdown helper function**

Add this function after the `listToMarkdown` function (at the end of the file, before the `cleanMarkdown` function):

```ts
/**
 * Convert a Tiptap table XmlElement to pipe-delimited markdown.
 * Expects children: tableRow elements, each containing tableHeader or tableCell elements.
 * Each cell contains a paragraph element with text.
 */
function tableToMarkdown(table: Y.XmlElement): string {
  const rows: string[][] = [];
  let headerRowIndex = -1;

  for (let i = 0; i < table.length; i++) {
    const row = table.get(i);
    if (!(row instanceof Y.XmlElement) || row.nodeName !== "tableRow") continue;

    const cells: string[] = [];
    let isHeaderRow = false;

    for (let j = 0; j < row.length; j++) {
      const cell = row.get(j);
      if (!(cell instanceof Y.XmlElement)) continue;

      if (cell.nodeName === "tableHeader") {
        isHeaderRow = true;
      }

      // Extract text from cell (cells contain paragraph elements)
      cells.push(getElementText(cell).replace(/\n/g, " ").trim());
    }

    if (isHeaderRow && headerRowIndex === -1) {
      headerRowIndex = rows.length;
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  // Determine column count from the widest row
  const colCount = Math.max(...rows.map((r) => r.length));

  let md = "";
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    // Pad row to colCount
    while (cells.length < colCount) cells.push("");
    md += "| " + cells.join(" | ") + " |\n";

    // Insert separator after header row
    if (i === headerRowIndex) {
      md += "| " + cells.map(() => "---").join(" | ") + " |\n";
    }
  }

  // If no header row was detected, insert separator after first row
  if (headerRowIndex === -1 && rows.length > 0) {
    const firstRowLine = md.split("\n")[0] + "\n";
    const separator = "| " + rows[0].map(() => "---").join(" | ") + " |\n";
    md = firstRowLine + separator + md.split("\n").slice(1).join("\n");
  }

  return md;
}
```

- [ ] **Step 3: Run the tests -- they should pass**

```bash
npx vitest run src/lib/__tests__/export-markdown-tables.test.ts
```

All 5 tests should pass.

- [ ] **Step 4: Run the full test suite**

```bash
npm run test
```

Ensure no regressions in existing tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export-markdown.ts
git commit -m "feat: add table markdown export with pipe-delimited format"
```

---

## Task 8: Server-Side Table Markdown Export

**Files:**
- Modified: `server/combined-server.mjs`

- [ ] **Step 1: Add table handler to the server's xmlFragmentToMarkdown**

In `server/combined-server.mjs`, in the `xmlFragmentToMarkdown` function, add a new `else if` branch for the `"table"` tag. Insert it after the `horizontalRule` branch (after `md += "---\n\n";` around line 159) and before the `else` fallback:

```js
      } else if (tag === "table") {
        md += tableToMarkdown(child);
        md += "\n";
```

- [ ] **Step 2: Add the tableToMarkdown helper function**

Add this function after the `listToMarkdown` function (after line 239) in `server/combined-server.mjs`:

```js
/**
 * Convert a Tiptap table XmlElement to pipe-delimited markdown.
 */
function tableToMarkdown(table) {
  const rows = [];
  let headerRowIndex = -1;

  for (let i = 0; i < table.length; i++) {
    const row = table.get(i);
    if (!(row instanceof Y.XmlElement) || row.nodeName !== "tableRow") continue;

    const cells = [];
    let isHeaderRow = false;

    for (let j = 0; j < row.length; j++) {
      const cell = row.get(j);
      if (!(cell instanceof Y.XmlElement)) continue;

      if (cell.nodeName === "tableHeader") {
        isHeaderRow = true;
      }

      cells.push(getElementText(cell).replace(/\n/g, " ").trim());
    }

    if (isHeaderRow && headerRowIndex === -1) {
      headerRowIndex = rows.length;
    }
    rows.push(cells);
  }

  if (rows.length === 0) return "";

  const colCount = Math.max(...rows.map((r) => r.length));

  let md = "";
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    while (cells.length < colCount) cells.push("");
    md += "| " + cells.join(" | ") + " |\n";

    if (i === headerRowIndex) {
      md += "| " + cells.map(() => "---").join(" | ") + " |\n";
    }
  }

  if (headerRowIndex === -1 && rows.length > 0) {
    const firstRowLine = md.split("\n")[0] + "\n";
    const separator = "| " + rows[0].map(() => "---").join(" | ") + " |\n";
    md = firstRowLine + separator + md.split("\n").slice(1).join("\n");
  }

  return md;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/combined-server.mjs
git commit -m "feat: add table markdown export to server-side persistence"
```

---

## Task 9: End-to-End Smoke Test

- [ ] **Step 1: Manual verification**

1. Start the dev server: `npm run dev`
2. Open a document at http://100.109.228.117:3000/
3. Type `/table` and select the Table command -- a 3x3 table appears with header row
4. Click the Table toolbar button -- another table is inserted
5. Type content in cells, verify Tab key moves between cells
6. Check the `documents/` directory for the `.md` file -- confirm table is exported as pipe-delimited markdown
7. Open the document in a second browser tab -- confirm table renders and syncs correctly

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat: table support -- slash command, toolbar, export, styling"
```

---

## Verification Checklist

- [ ] Table extensions installed and registered (no console errors)
- [ ] `/table` slash command inserts a 3x3 table with header row
- [ ] Toolbar button inserts a 3x3 table with header row
- [ ] Table cells are styled with warm borders matching the app theme
- [ ] Selected cells have a visible highlight
- [ ] Tab key navigates between cells
- [ ] Table markdown export produces pipe-delimited format with header separator
- [ ] Server-side markdown persistence includes table export
- [ ] All existing tests pass (no regressions)
- [ ] Table export unit tests pass
- [ ] Two browser tabs can edit the same table concurrently

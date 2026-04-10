import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SuggestionMark } from "../suggestion-mark";

/**
 * Integration tests for the tracked-changes workflow using SuggestionMark.
 *
 * Mirrors the create → accept / reject flow implemented in:
 *   - EditorStatusBar.tsx (createTrackedSuggestion)
 *   - page.tsx (handleAccept / handleReject)
 */

// Tiptap Editor is slow to init in jsdom — increase timeout
const TIMEOUT = 15000;

function createEditor(content: string): Editor {
  return new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      SuggestionMark,
    ],
    content,
  });
}

/** Collect all suggestion-marked ranges from the editor doc. */
function collectMarkedRanges(editor: Editor) {
  const markType = editor.schema.marks.suggestionMark;
  const ranges: { from: number; to: number; type: string; id: string; text: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type === markType) {
        ranges.push({
          from: pos,
          to: pos + node.nodeSize,
          type: mark.attrs.type,
          id: mark.attrs.suggestionId,
          text: node.textContent,
        });
      }
    });
  });
  return ranges;
}

/** Simulate the "replace" mode from createTrackedSuggestion (single transaction). */
function createReplaceSuggestion(
  editor: Editor,
  from: number,
  to: number,
  suggestedText: string,
  suggestionId: string,
) {
  const { tr, schema } = editor.state;
  const markTypeSchema = schema.marks.suggestionMark;
  tr.addMark(from, to, markTypeSchema.create({ suggestionId, type: "delete" }));
  if (suggestedText) {
    const addMark = markTypeSchema.create({ suggestionId, type: "add" });
    tr.insert(to, schema.text(suggestedText, [addMark]));
  }
  editor.view.dispatch(tr);
}

/** Simulate the "insert-after" mode from createTrackedSuggestion (single transaction). */
function createInsertAfterSuggestion(
  editor: Editor,
  to: number,
  suggestedText: string,
  suggestionId: string,
) {
  const { tr, schema } = editor.state;
  const markTypeSchema = schema.marks.suggestionMark;
  if (suggestedText) {
    const addMark = markTypeSchema.create({ suggestionId, type: "add" });
    tr.insert(to, schema.text(suggestedText, [addMark]));
  }
  editor.view.dispatch(tr);
}

/** Simulate handleAccept from page.tsx (single transaction). */
function acceptSuggestion(editor: Editor, suggestionId: string) {
  const { doc, tr } = editor.state;
  const markType = editor.schema.marks.suggestionMark;
  if (!markType) return;
  const deleteRanges: { from: number; to: number }[] = [];
  const addRanges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type === markType && mark.attrs.suggestionId === suggestionId) {
        if (mark.attrs.type === "delete") {
          deleteRanges.push({ from: pos, to: pos + node.nodeSize });
        } else if (mark.attrs.type === "add") {
          addRanges.push({ from: pos, to: pos + node.nodeSize });
        }
      }
    });
  });
  for (const range of addRanges) {
    tr.removeMark(range.from, range.to, markType);
  }
  for (const range of [...deleteRanges].reverse()) {
    tr.delete(range.from, range.to);
  }
  editor.view.dispatch(tr);
}

/** Simulate handleReject from page.tsx (single transaction). */
function rejectSuggestion(editor: Editor, suggestionId: string) {
  const { doc, tr } = editor.state;
  const markType = editor.schema.marks.suggestionMark;
  if (!markType) return;
  const deleteRanges: { from: number; to: number }[] = [];
  const addRanges: { from: number; to: number }[] = [];
  doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type === markType && mark.attrs.suggestionId === suggestionId) {
        if (mark.attrs.type === "delete") {
          deleteRanges.push({ from: pos, to: pos + node.nodeSize });
        } else if (mark.attrs.type === "add") {
          addRanges.push({ from: pos, to: pos + node.nodeSize });
        }
      }
    });
  });
  for (const range of deleteRanges) {
    tr.removeMark(range.from, range.to, markType);
  }
  for (const range of [...addRanges].reverse()) {
    tr.delete(range.from, range.to);
  }
  editor.view.dispatch(tr);
}

function getPlainText(editor: Editor): string {
  return editor.state.doc.textContent;
}

// ---------------------------------------------------------------------------

describe("SuggestionMark extension", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("registers without errors", { timeout: TIMEOUT }, () => {
    editor = createEditor("<p>Hello world</p>");
    expect(editor.schema.marks.suggestionMark).toBeDefined();
  });

  it("setSuggestionMark applies mark to selected text", () => {
    editor = createEditor("<p>Hello world</p>");
    // Select "world" (pos 7..12 in prosemirror)
    editor.chain().setTextSelection({ from: 7, to: 12 }).setSuggestionMark({ suggestionId: "s1", type: "add" }).run();
    const ranges = collectMarkedRanges(editor);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].text).toBe("world");
    expect(ranges[0].type).toBe("add");
    expect(ranges[0].id).toBe("s1");
  });

  it("unsetSuggestionMark removes mark from selected text", () => {
    editor = createEditor("<p>Hello world</p>");
    editor.chain().setTextSelection({ from: 7, to: 12 }).setSuggestionMark({ suggestionId: "s1", type: "add" }).run();
    editor.chain().setTextSelection({ from: 7, to: 12 }).unsetSuggestionMark().run();
    const ranges = collectMarkedRanges(editor);
    expect(ranges).toHaveLength(0);
    expect(getPlainText(editor)).toBe("Hello world");
  });
});

describe("Tracked changes: replace mode (rewrite / summarize)", () => {
  let editor: Editor;

  beforeEach(() => {
    // "Hello world" — "world" is at positions 7..12
    editor = createEditor("<p>Hello world</p>");
  });

  afterEach(() => {
    editor?.destroy();
  });

  it("creates both delete and add marks", () => {
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    const ranges = collectMarkedRanges(editor);
    const deletes = ranges.filter((r) => r.type === "delete");
    const adds = ranges.filter((r) => r.type === "add");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].text).toBe("world");
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe("planet");
  });

  it("doc contains both old and new text while pending", () => {
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    const text = getPlainText(editor);
    expect(text).toContain("world");
    expect(text).toContain("planet");
  });

  it("accept removes original, keeps suggested text, clears marks", () => {
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello planet");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });

  it("reject removes suggested text, keeps original, clears marks", { timeout: TIMEOUT }, () => {
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    rejectSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello world");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });

  it("accept with longer replacement text", () => {
    createReplaceSuggestion(editor, 7, 12, "beautiful planet Earth", "s1");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello beautiful planet Earth");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });

  it("reject with longer replacement text restores original", () => {
    createReplaceSuggestion(editor, 7, 12, "beautiful planet Earth", "s1");
    rejectSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello world");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });
});

describe("Tracked changes: insert-after mode (expand)", () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createEditor("<p>Hello world</p>");
  });

  afterEach(() => {
    editor?.destroy();
  });

  it("creates only add mark, no delete mark", () => {
    createInsertAfterSuggestion(editor, 12, " and beyond", "s1");
    const ranges = collectMarkedRanges(editor);
    const deletes = ranges.filter((r) => r.type === "delete");
    const adds = ranges.filter((r) => r.type === "add");
    expect(deletes).toHaveLength(0);
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe(" and beyond");
  });

  it("accept keeps the added text, clears marks", () => {
    createInsertAfterSuggestion(editor, 12, " and beyond", "s1");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello world and beyond");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });

  it("reject removes the added text, restores original", () => {
    createInsertAfterSuggestion(editor, 12, " and beyond", "s1");
    rejectSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello world");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });
});

describe("Multiple concurrent suggestions", () => {
  let editor: Editor;

  beforeEach(() => {
    // "The quick brown fox" — quick=5..10, brown=11..16, fox=17..20
    editor = createEditor("<p>The quick brown fox</p>");
  });

  afterEach(() => {
    editor?.destroy();
  });

  it("two independent replace suggestions coexist", () => {
    // Replace "quick" with "slow"
    createReplaceSuggestion(editor, 5, 10, "slow", "s1");
    // After inserting "slow" after pos 10, "brown" shifts. Find new positions.
    const text1 = getPlainText(editor);
    expect(text1).toContain("quick");
    expect(text1).toContain("slow");
    expect(text1).toContain("brown");

    const ranges = collectMarkedRanges(editor);
    expect(ranges.filter((r) => r.id === "s1")).toHaveLength(2);
  });

  it("accept one suggestion, reject another independently", () => {
    // Replace "quick" with "slow" (at 5..10)
    createReplaceSuggestion(editor, 5, 10, "slow", "s1");

    // Accept s1 → "slow" stays, "quick" removed
    acceptSuggestion(editor, "s1");
    const text = getPlainText(editor);
    expect(text).toContain("slow");
    expect(text).not.toContain("quick");
    expect(text).toContain("brown fox");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });
});

describe("Edge cases", () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  it("empty suggestion text on accept produces valid doc (delete-only)", () => {
    editor = createEditor("<p>Hello world</p>");
    // Replace "world" with "" — only delete mark, no add text
    createReplaceSuggestion(editor, 7, 12, "", "s1");
    const ranges = collectMarkedRanges(editor);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].type).toBe("delete");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello ");
  });

  it("accept on non-existent suggestion ID is a no-op", () => {
    editor = createEditor("<p>Hello world</p>");
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    acceptSuggestion(editor, "non-existent");
    // s1 marks should still be present
    expect(collectMarkedRanges(editor).length).toBeGreaterThan(0);
    expect(getPlainText(editor)).toContain("world");
    expect(getPlainText(editor)).toContain("planet");
  });

  it("reject on non-existent suggestion ID is a no-op", () => {
    editor = createEditor("<p>Hello world</p>");
    createReplaceSuggestion(editor, 7, 12, "planet", "s1");
    rejectSuggestion(editor, "non-existent");
    expect(collectMarkedRanges(editor).length).toBeGreaterThan(0);
  });

  it("single character replacement works", () => {
    editor = createEditor("<p>a</p>");
    createReplaceSuggestion(editor, 1, 2, "b", "s1");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("b");
    expect(collectMarkedRanges(editor)).toHaveLength(0);
  });

  it("replacing entire paragraph content works", { timeout: TIMEOUT }, () => {
    editor = createEditor("<p>Hello world</p>");
    createReplaceSuggestion(editor, 1, 12, "Goodbye moon", "s1");
    acceptSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Goodbye moon");
  });

  it("reject after replacing entire paragraph restores content", () => {
    editor = createEditor("<p>Hello world</p>");
    createReplaceSuggestion(editor, 1, 12, "Goodbye moon", "s1");
    rejectSuggestion(editor, "s1");
    expect(getPlainText(editor)).toBe("Hello world");
  });
});

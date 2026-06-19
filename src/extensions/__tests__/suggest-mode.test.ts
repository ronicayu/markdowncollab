import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import * as Y from "yjs";
import { SuggestionMark } from "../suggestion-mark";
import { SuggestModeExtension, setSuggestModeEnabled } from "../suggest-mode";
import { getSuggestions } from "@/lib/suggestion-store";

const TIMEOUT = 15000;

function makeEditor(
  content: string,
  enabled = true,
): { editor: Editor; ydoc: Y.Doc } {
  const ydoc = new Y.Doc();
  const editor = new Editor({
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      SuggestionMark,
      SuggestModeExtension.configure({
        initialEnabled: enabled,
        authorName: "Tester",
        authorType: "human",
        documentId: "doc-test",
        ydoc,
      }),
    ],
    content,
  });
  return { editor, ydoc };
}

function collectRanges(editor: Editor) {
  const markType = editor.schema.marks.suggestionMark;
  const ranges: { type: string; id: string; text: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    node.marks.forEach((mark) => {
      if (mark.type === markType) {
        ranges.push({
          type: mark.attrs.type,
          id: mark.attrs.suggestionId,
          text: editor.state.doc.textBetween(pos, pos + node.nodeSize, ""),
        });
      }
    });
  });
  return ranges;
}

describe("SuggestModeExtension", () => {
  let handle: ReturnType<typeof makeEditor>;

  afterEach(() => {
    handle?.editor.destroy();
  });

  it("insertion is wrapped in an 'add' mark and recorded in Yjs", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello </p>");
    // Insert "world" at end of "Hello " (position 7)
    const { tr } = handle.editor.state;
    tr.insertText("world", 7, 7);
    handle.editor.view.dispatch(tr);

    const ranges = collectRanges(handle.editor);
    const adds = ranges.filter((r) => r.type === "add");
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe("world");

    const stored = getSuggestions(handle.ydoc);
    expect(stored).toHaveLength(1);
    expect(stored[0].suggestedText).toBe("world");
    expect(stored[0].originalText).toBe("");
    expect(stored[0].authorType).toBe("human");
    expect(stored[0].status).toBe("pending");
    expect(stored[0].id).toBe(adds[0].id);
  });

  it("deletion re-inserts content wrapped as 'delete'", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello world</p>");
    // Delete "world" (positions 7..12)
    const { tr } = handle.editor.state;
    tr.delete(7, 12);
    handle.editor.view.dispatch(tr);

    const ranges = collectRanges(handle.editor);
    const deletes = ranges.filter((r) => r.type === "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].text).toBe("world");

    const stored = getSuggestions(handle.ydoc);
    expect(stored[0].originalText).toBe("world");
    expect(stored[0].suggestedText).toBe("");
  });

  it("replace produces paired add + delete with same suggestionId", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello world</p>");
    const { tr, schema } = handle.editor.state;
    tr.replaceWith(7, 12, schema.text("planet"));
    handle.editor.view.dispatch(tr);

    const ranges = collectRanges(handle.editor);
    const deletes = ranges.filter((r) => r.type === "delete");
    const adds = ranges.filter((r) => r.type === "add");
    expect(deletes).toHaveLength(1);
    expect(adds).toHaveLength(1);
    expect(deletes[0].text).toBe("world");
    expect(adds[0].text).toBe("planet");
    expect(deletes[0].id).toBe(adds[0].id);
  });

  it("passes through when disabled", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello</p>", false);
    const { tr } = handle.editor.state;
    tr.insertText(" world", 6, 6);
    handle.editor.view.dispatch(tr);

    expect(collectRanges(handle.editor)).toHaveLength(0);
    expect(getSuggestions(handle.ydoc)).toHaveLength(0);
    expect(handle.editor.state.doc.textContent).toBe("Hello world");
  });

  it("skips transactions tagged with aiSuggestion meta", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello </p>");
    const { tr } = handle.editor.state;
    tr.insertText("world", 7, 7);
    tr.setMeta("aiSuggestion", true);
    handle.editor.view.dispatch(tr);

    expect(collectRanges(handle.editor)).toHaveLength(0);
    expect(getSuggestions(handle.ydoc)).toHaveLength(0);
  });

  it("skips transactions tagged with suggestionWrap meta", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hello </p>");
    const { tr } = handle.editor.state;
    tr.insertText("world", 7, 7);
    tr.setMeta("suggestionWrap", true);
    handle.editor.view.dispatch(tr);

    expect(collectRanges(handle.editor)).toHaveLength(0);
  });

  it("setSuggestModeEnabled toggles behavior mid-session", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Hi</p>", false);
    setSuggestModeEnabled(
      handle.editor as unknown as { view: { state: unknown; dispatch: (t: unknown) => void } },
      true,
    );
    const tr = handle.editor.state.tr.insertText("X", 1, 1);
    handle.editor.view.dispatch(tr);
    const adds = collectRanges(handle.editor).filter((r) => r.type === "add");
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe("X");
  });

  it("large paste becomes one add-suggestion", { timeout: TIMEOUT }, () => {
    handle = makeEditor("<p>Start </p>");
    const { tr, schema } = handle.editor.state;
    const longText = "a".repeat(200);
    tr.insert(7, schema.text(longText));
    handle.editor.view.dispatch(tr);

    const adds = collectRanges(handle.editor).filter((r) => r.type === "add");
    expect(adds).toHaveLength(1);
    expect(adds[0].text).toBe(longText);
    expect(getSuggestions(handle.ydoc)).toHaveLength(1);
  });
});

import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SuggestionMark } from "../../src/extensions/suggestion-mark";

let editor: Editor | null = null;

function createEditor(content: string) {
  editor = new Editor({
    extensions: [StarterKit, SuggestionMark],
    content,
  });
  return editor;
}

describe("SuggestionMark", () => {
  afterEach(() => {
    // Destroy the editor so Tiptap's deferred view callbacks don't fire after
    // jsdom teardown ("document is not defined"). Matches sibling editor tests.
    editor?.destroy();
    editor = null;
  });

  it("can apply a suggestion-add mark to selected text", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 7, to: 12 }); // "world"
    editor.commands.setSuggestionMark({
      suggestionId: "s1",
      type: "add",
    });

    const html = editor.getHTML();
    expect(html).toContain('data-suggestion-id="s1"');
    expect(html).toContain('data-suggestion-type="add"');
  });

  it("can apply a suggestion-delete mark to selected text", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 1, to: 6 }); // "Hello"
    editor.commands.setSuggestionMark({
      suggestionId: "s2",
      type: "delete",
    });

    const html = editor.getHTML();
    expect(html).toContain('data-suggestion-type="delete"');
  });

  it("can remove a suggestion mark", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.setSuggestionMark({ suggestionId: "s1", type: "add" });
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.unsetSuggestionMark();

    const html = editor.getHTML();
    expect(html).not.toContain("data-suggestion-id");
  });
});

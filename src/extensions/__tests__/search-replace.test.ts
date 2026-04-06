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

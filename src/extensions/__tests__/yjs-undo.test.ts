import { describe, it, expect, vi } from "vitest";

// The YjsUndo extension depends on y-prosemirror which requires a Yjs Y.Doc
// at plugin creation time. We test that the extension module exports correctly
// and that the extension object has the expected shape.

describe("YjsUndo extension", () => {
  it("exports a valid Tiptap extension", async () => {
    const { YjsUndo } = await import("../yjs-undo");
    expect(YjsUndo).toBeDefined();
    expect(YjsUndo.name).toBe("yjsUndo");
  });

  it("has keyboard shortcuts and commands configured", async () => {
    const { YjsUndo } = await import("../yjs-undo");
    // The extension config should declare addKeyboardShortcuts and addCommands
    expect(YjsUndo.config.addKeyboardShortcuts).toBeDefined();
    expect(YjsUndo.config.addCommands).toBeDefined();
    expect(YjsUndo.config.addProseMirrorPlugins).toBeDefined();
  });
});

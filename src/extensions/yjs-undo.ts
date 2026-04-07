import { Extension } from "@tiptap/core";
import { yUndoPlugin, undo as yUndo, redo as yRedo } from "y-prosemirror";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    yjsUndo: {
      undo: () => ReturnType;
      redo: () => ReturnType;
    };
  }
}

/**
 * Tiptap extension that integrates Yjs undo/redo.
 *
 * Uses `y-prosemirror`'s `yUndoPlugin` which wraps `Y.UndoManager` --
 * this means undoing only reverts the local user's changes, not
 * collaborators' edits.
 *
 * Registers Mod-z -> undo, Mod-Shift-z -> redo, and exposes
 * editor.commands.undo() / editor.commands.redo() for toolbar use.
 */
export const YjsUndo = Extension.create({
  name: "yjsUndo",

  addProseMirrorPlugins() {
    return [yUndoPlugin()];
  },

  addCommands() {
    return {
      undo:
        () =>
        ({ state }) => {
          return yUndo(state);
        },
      redo:
        () =>
        ({ state }) => {
          return yRedo(state);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-z": () => this.editor.commands.undo(),
      "Mod-Shift-z": () => this.editor.commands.redo(),
    };
  },
});

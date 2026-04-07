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
        ({ state, dispatch }) => {
          return yUndo(state, dispatch);
        },
      redo:
        () =>
        ({ state, dispatch }) => {
          return yRedo(state, dispatch);
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

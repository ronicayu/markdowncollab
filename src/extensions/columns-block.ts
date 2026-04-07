/**
 * ColumnsBlock — a custom Tiptap Node for two-column side-by-side layouts.
 *
 * Contains two "column" child nodes, each independently editable.
 * Renders as a CSS grid: 2 columns, 50/50 split, stacks on mobile.
 *
 * Usage in Editor.tsx:
 *   import { ColumnsBlock, Column } from "@/extensions/columns-block";
 *   extensions: [ ..., ColumnsBlock, Column ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnsBlock: {
      /**
       * Insert a two-column layout block.
       */
      setColumns: () => ReturnType;
    };
  }
}

/**
 * Column node — a single column inside a ColumnsBlock.
 * Acts as a block content container.
 */
export const Column = Node.create({
  name: "column",

  group: "column",

  content: "block+",

  defining: true,

  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "column",
        class: "columns-block-column",
      }),
      0,
    ];
  },
});

/**
 * ColumnsBlock node — a two-column layout wrapper.
 */
export const ColumnsBlock = Node.create({
  name: "columnsBlock",

  group: "block",

  content: "column column",

  defining: true,

  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="columnsBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "columnsBlock",
        class: "columns-block",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: [
              {
                type: "column",
                content: [{ type: "paragraph" }],
              },
              {
                type: "column",
                content: [{ type: "paragraph" }],
              },
            ],
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Tab moves focus to the next column
      Tab: ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // Walk up to find if we're inside a column within a columnsBlock
        for (let depth = $from.depth; depth >= 1; depth--) {
          const node = $from.node(depth);
          if (node.type.name === "column") {
            const parentDepth = depth - 1;
            const parentNode = $from.node(parentDepth);
            if (parentNode.type.name === "columnsBlock") {
              // Find which column index we're in
              const columnIndex = $from.index(parentDepth);
              if (columnIndex === 0) {
                // Move to the start of the second column
                const secondColumnStart = $from.start(parentDepth) + parentNode.child(0).nodeSize;
                editor
                  .chain()
                  .command(({ tr, dispatch }) => {
                    if (dispatch) {
                      tr.setSelection(TextSelection.create(tr.doc, secondColumnStart + 1));
                    }
                    return true;
                  })
                  .run();
                return true;
              }
            }
          }
        }
        return false;
      },
    };
  },
});

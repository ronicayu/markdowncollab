/**
 * CalloutBlock — a custom Tiptap Node for styled callout/admonition blocks.
 *
 * Supports four types: info, warning, tip, danger.
 * Renders as a <div class="callout callout-{type}"> with a type icon prefix.
 *
 * Usage in Editor.tsx:
 *   import { CalloutBlock } from "@/extensions/callout-block";
 *   extensions: [ ..., CalloutBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

export type CalloutType = "info" | "warning" | "tip" | "danger";

const CALLOUT_ICONS: Record<CalloutType, string> = {
  info: "\u2139\uFE0F",
  warning: "\u26A0\uFE0F",
  tip: "\uD83D\uDCA1",
  danger: "\uD83D\uDEA8",
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      /**
       * Insert a callout block with the given type.
       */
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType;
    };
  }
}

export const CalloutBlock = Node.create({
  name: "callout",

  group: "block",

  content: "inline*",

  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info" as CalloutType,
        parseHTML: (element) =>
          (element.getAttribute("data-type") as CalloutType) || "info",
        renderHTML: (attributes) => ({
          "data-type": attributes.type,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[class*="callout"]',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const type = el.getAttribute("data-type") || "info";
          return { type };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = (node.attrs.type as CalloutType) || "info";
    const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.info;

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        class: `callout callout-${type}`,
        "data-type": type,
      }),
      ["span", { class: "callout-icon", contenteditable: "false" }, icon],
      ["span", { class: "callout-content" }, 0],
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { type: attrs?.type || "info" },
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Enter at the end of a callout creates a new paragraph below
      Enter: ({ editor }) => {
        const { state } = editor;
        const { $from, empty } = state.selection;

        if (!empty) return false;

        // Check if we're inside a callout
        const calloutNode = $from.node($from.depth);
        if (calloutNode.type.name !== this.name) return false;

        // Only at the end of the callout
        const isAtEnd = $from.parentOffset === calloutNode.content.size;
        if (!isAtEnd) return false;

        // Insert a new paragraph after the callout
        const after = $from.after($from.depth);
        editor
          .chain()
          .command(({ tr, dispatch }) => {
            if (dispatch) {
              const paragraphType = state.schema.nodes.paragraph;
              tr.insert(after, paragraphType.create());
              tr.setSelection(TextSelection.create(tr.doc, after + 1));
            }
            return true;
          })
          .run();

        return true;
      },
    };
  },
});

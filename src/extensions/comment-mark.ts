import { Mark, mergeAttributes } from "@tiptap/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Fragment, Slice, type Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const commentDecorationKey = new PluginKey<string | null>(
  "commentDecoration"
);

export const CommentMark = Mark.create({
  name: "commentMark",

  inclusive: false,

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.commentId) return {};
          return { "data-comment-id": attrs.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        class: "comment-highlight",
      }),
      0,
    ];
  },

  addProseMirrorPlugins() {
    // Capture mark type in closure — `this.type` is available here
    const markType = this.type;

    return [
      // Decoration plugin: highlights the active comment's marks
      new Plugin({
        key: commentDecorationKey,
        state: {
          init: () => null as string | null,
          apply(tr, value) {
            const meta = tr.getMeta(commentDecorationKey);
            return meta !== undefined ? (meta as string | null) : value;
          },
        },
        props: {
          decorations(state) {
            const activeId = commentDecorationKey.getState(state);
            if (!activeId) return DecorationSet.empty;
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isInline) return;
              node.marks.forEach((mark) => {
                if (
                  mark.type === markType &&
                  mark.attrs.commentId === activeId
                ) {
                  decorations.push(
                    Decoration.inline(pos, pos + node.nodeSize, {
                      class: "comment-highlight-active",
                    })
                  );
                }
              });
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),

      // Paste plugin: strip comment marks from pasted content
      new Plugin({
        key: new PluginKey("commentMarkPaste"),
        props: {
          transformPasted(slice) {
            function stripCommentMarks(node: PmNode): PmNode {
              if (node.isText) {
                const kept = node.marks.filter((m) => m.type !== markType);
                return kept.length === node.marks.length
                  ? node
                  : node.mark(kept);
              }
              const children: PmNode[] = [];
              node.forEach((child) => children.push(stripCommentMarks(child)));
              return node.copy(Fragment.from(children));
            }
            const content: PmNode[] = [];
            slice.content.forEach((node) =>
              content.push(stripCommentMarks(node))
            );
            return new Slice(
              Fragment.from(content),
              slice.openStart,
              slice.openEnd
            );
          },
        },
      }),
    ];
  },
});

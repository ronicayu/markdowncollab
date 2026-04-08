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

      // Tooltip plugin: show comment text on hover over comment marks
      new Plugin({
        key: new PluginKey("commentMarkTooltip"),
        props: {
          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              const mark = target.closest?.("mark.comment-highlight, mark.comment-highlight-active");
              if (!mark) {
                const existing = document.getElementById("comment-hover-tooltip");
                if (existing) existing.remove();
                return false;
              }
              const commentId = mark.getAttribute("data-comment-id");
              if (!commentId) return false;

              // Don't recreate if already showing for same comment
              const existing = document.getElementById("comment-hover-tooltip");
              if (existing && existing.dataset.commentId === commentId) return false;
              if (existing) existing.remove();

              // Find comment text from sidebar comment cards
              const commentCard = document.querySelector(`[data-comment-id="${commentId}"]`);
              const commentText = commentCard?.querySelector("p.text-sm")?.textContent?.trim();
              if (!commentText) return false;

              const tooltip = document.createElement("div");
              tooltip.id = "comment-hover-tooltip";
              tooltip.dataset.commentId = commentId;
              tooltip.className = "fixed z-[100] max-w-xs px-3 py-2 text-xs text-gray-700 bg-white border border-amber-200 rounded-lg shadow-lg pointer-events-none";
              tooltip.textContent = commentText.length > 120 ? commentText.slice(0, 120) + "..." : commentText;

              const rect = mark.getBoundingClientRect();
              tooltip.style.top = `${rect.top - 36}px`;
              tooltip.style.left = `${rect.left + rect.width / 2}px`;
              tooltip.style.transform = "translateX(-50%)";
              document.body.appendChild(tooltip);
              return false;
            },
            mouseout(_view, event) {
              const related = (event as MouseEvent).relatedTarget as HTMLElement | null;
              if (related?.closest?.("mark.comment-highlight, mark.comment-highlight-active")) return false;
              const existing = document.getElementById("comment-hover-tooltip");
              if (existing) existing.remove();
              return false;
            },
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

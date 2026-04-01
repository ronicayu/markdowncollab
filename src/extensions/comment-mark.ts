import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentMark = Mark.create({
  name: "commentMark",

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
        style:
          "background-color: #FEF3C7; border-bottom: 2px solid #F59E0B;",
      }),
      0,
    ];
  },
});

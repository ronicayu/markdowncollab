import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CanvasNodeView from "@/components/CanvasNodeView";

export const CanvasBlock = Node.create({
  name: "canvasBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      dataUrl: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url") ?? "",
        renderHTML: (attributes) => ({
          "data-url": attributes.dataUrl,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="canvas-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "canvas-block" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasNodeView);
  },
});

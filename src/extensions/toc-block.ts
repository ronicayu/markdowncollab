/**
 * TocBlock — a custom Tiptap Node that renders an auto-generated Table of
 * Contents from the document's headings. Updates on document change
 * (debounced) and supports click-to-scroll.
 *
 * Usage in Editor.tsx:
 *   import { TocBlock } from "@/extensions/toc-block";
 *   extensions: [ ..., TocBlock ]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useEffect, useState, useCallback, useRef } from "react";
import React from "react";

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
  pos: number;
}

function TocNodeView({ editor }: { editor: any }) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scanHeadings = useCallback(() => {
    const entries: HeadingEntry[] = [];
    const { doc } = editor.state;
    doc.descendants((node: any, pos: number) => {
      if (node.type.name === "heading") {
        const level = node.attrs.level as number;
        const text = node.textContent;
        const id = `heading-${pos}`;
        if (text.trim()) {
          entries.push({ id, text, level, pos });
        }
      }
    });
    setHeadings(entries);
  }, [editor]);

  useEffect(() => {
    // Initial scan
    scanHeadings();

    // Debounced update on every transaction
    const handler = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(scanHeadings, 300);
    };

    editor.on("update", handler);
    return () => {
      editor.off("update", handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, scanHeadings]);

  function scrollToHeading(pos: number) {
    // Focus the editor at the heading position
    editor.chain().focus().setTextSelection(pos + 1).run();

    // Scroll the heading DOM node into view
    const { view } = editor;
    const dom = view.domAtPos(pos + 1);
    const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return React.createElement(
    NodeViewWrapper,
    { className: "toc-block", contentEditable: false },
    React.createElement("div", { className: "toc-block-title" }, "Table of Contents"),
    headings.length === 0
      ? React.createElement(
          "p",
          { className: "toc-block-empty" },
          "No headings found. Add headings to generate a table of contents."
        )
      : React.createElement(
          "nav",
          { className: "toc-block-list" },
          headings.map((h) =>
            React.createElement(
              "button",
              {
                key: `${h.pos}-${h.text}`,
                className: `toc-block-entry toc-level-${h.level}`,
                onClick: () => scrollToHeading(h.pos),
                type: "button",
              },
              h.text
            )
          )
        )
  );
}

export const TocBlock = Node.create({
  name: "tocBlock",

  group: "block",

  atom: true,

  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="toc-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "toc-block", class: "toc-block" }),
      "Table of Contents",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocNodeView);
  },
});

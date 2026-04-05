"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

interface Heading {
  level: number;
  text: string;
  pos: number;
}

interface OutlineSidebarProps {
  editor: Editor | null;
}

export default function OutlineSidebar({ editor }: OutlineSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    editor.on("update", updateHeadings);
    updateHeadings();

    return () => {
      editor.off("update", updateHeadings);
    };
  }, [editor]);

  return (
    <div className="w-52 border-r border-[#E8D8C0] bg-[#F5EBD8] p-4 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-400 tracking-widest mb-3">OUTLINE</p>
      {headings.length === 0 ? (
        <p className="text-xs text-gray-400">No headings yet</p>
      ) : (
        <div className="space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                if (!editor) return;
                // Move cursor to the heading node (pos+1 to be inside the node)
                editor.commands.setTextSelection(h.pos + 1);
                // First try to scroll the corresponding DOM element into view
                const editorDom = editor.view.dom;
                // Find the heading element by iterating ProseMirror node views
                // via the DOM — headings render as h1–h6 elements
                const headingTag = `h${h.level}`;
                const headingEls = editorDom.querySelectorAll(headingTag);
                // Match by text content
                let matched: Element | null = null;
                headingEls.forEach((el) => {
                  if (el.textContent?.trim() === h.text.trim() && !matched) {
                    matched = el;
                  }
                });
                if (matched) {
                  (matched as Element).scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  editor.commands.scrollIntoView();
                }
              }}
              className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 truncate py-1.5 px-2 rounded-md hover:bg-[#E8D8C0] transition-colors"
              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

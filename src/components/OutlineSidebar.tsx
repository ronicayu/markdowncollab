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
  const [collapsed, setCollapsed] = useState(false);

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

  if (collapsed) {
    return (
      <div className="border-r border-[#E8D8C0] bg-[#F5EBD8] p-2 flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
          title="Show outline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-[#E8D8C0] bg-[#F5EBD8] p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 tracking-widest">OUTLINE</p>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
          title="Hide outline"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-gray-400">No headings yet</p>
      ) : (
        <div className="space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                if (!editor) return;
                editor.commands.setTextSelection(h.pos + 1);
                const editorDom = editor.view.dom;
                const headingTag = `h${h.level}`;
                const headingEls = editorDom.querySelectorAll(headingTag);
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

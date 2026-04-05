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
                editor?.commands.setTextSelection(h.pos);
                editor?.commands.scrollIntoView();
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

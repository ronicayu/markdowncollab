"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

interface Command {
  id: string;
  label: string;
  description: string;
  icon: string;
  keywords: string[];
  action: (editor: Editor) => void;
}

const COMMANDS: Command[] = [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    icon: "H1",
    keywords: ["h1", "heading", "title"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    keywords: ["h2", "heading", "subtitle"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    keywords: ["h3", "heading"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Unordered list",
    icon: "•",
    keywords: ["bullet", "list", "ul", "unordered"],
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Ordered List",
    description: "Numbered list",
    icon: "1.",
    keywords: ["ordered", "list", "ol", "numbered"],
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "quote",
    label: "Blockquote",
    description: "Quote or callout",
    icon: "❝",
    keywords: ["quote", "blockquote", "callout"],
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code Block",
    description: "Fenced code block",
    icon: "</>",
    keywords: ["code", "block", "pre"],
    action: (editor) => editor.chain().focus().setNode("codeBlock").run(),
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    description: "Flowcharts, sequences, and more",
    icon: "◇",
    keywords: ["mermaid", "diagram", "chart", "flow"],
    action: (editor) =>
      editor.chain().focus().setNode("mermaidBlock", { content: "graph LR\n  A --> B" }).run(),
  },
  {
    id: "divider",
    label: "Divider",
    description: "Horizontal rule",
    icon: "—",
    keywords: ["divider", "hr", "rule", "line"],
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Image",
    description: "Upload an image",
    icon: "\uD83D\uDDBC",
    keywords: ["image", "picture", "photo", "upload", "img"],
    action: (editor) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        // Extract document ID from URL: /doc/{id}
        const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
        if (!docId) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`/api/documents/${docId}/upload`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            console.error("Upload failed");
            return;
          }
          const data = await res.json();
          editor.chain().focus().setImage({ src: data.url }).run();
        } catch (err) {
          console.error("Upload error:", err);
        }
      };
      input.click();
    },
  },
  {
    id: "table",
    label: "Table",
    description: "Insert a 3x3 table",
    icon: "▦",
    keywords: ["table", "grid", "spreadsheet"],
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
];

interface SlashCommandMenuProps {
  editor: Editor;
  query: string;
  position: { top: number; left: number };
  onClose: () => void;
}

export default function SlashCommandMenu({
  editor,
  query,
  position,
  onClose,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.startsWith(q))
    );
  });

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.querySelector("[data-selected='true']") as HTMLElement;
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCommand(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, selectedIndex, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  function runCommand(cmd: Command | undefined) {
    if (!cmd) return;
    // Delete the slash + typed query from the document
    const { state } = editor;
    const { $from } = state.selection;
    const slashStart = $from.pos - query.length - 1; // -1 for the "/" itself
    editor
      .chain()
      .focus()
      .deleteRange({ from: slashStart, to: $from.pos })
      .command(({ tr, dispatch }) => {
        if (dispatch) dispatch(tr);
        return true;
      })
      .run();
    cmd.action(editor);
    onClose();
  }

  if (filtered.length === 0) {
    onClose();
    return null;
  }

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: position.top + 4,
    left: position.left,
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-y-auto max-h-72"
      onMouseDown={(e) => e.preventDefault()} // prevent editor blur
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          data-selected={i === selectedIndex ? "true" : "false"}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => runCommand(cmd)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex
              ? "bg-amber-50"
              : "hover:bg-gray-50"
          }`}
        >
          <span className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
            {cmd.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{cmd.label}</p>
            <p className="text-xs text-gray-400 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

"use client";

import type { Editor } from "@tiptap/core";

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  label: string;
  action: () => void;
  isActive: () => boolean;
}

export default function Toolbar({ editor }: ToolbarProps) {
  if (!editor) return null;

  const buttons: ToolbarButton[] = [
    {
      label: "B",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "I",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "S",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
    },
    {
      label: "Code",
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
    },
    {
      label: "H1",
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive("heading", { level: 1 }),
    },
    {
      label: "H2",
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
    },
    {
      label: "H3",
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive("heading", { level: 3 }),
    },
    {
      label: "Bullet",
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
    },
    {
      label: "Ordered",
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive("orderedList"),
    },
    {
      label: "Quote",
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
    },
    {
      label: "Code Block",
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive("codeBlock"),
    },
    {
      label: "HR",
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
    },
  ];

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 overflow-x-auto border-b border-gray-200 bg-white px-3 py-1.5">
      {buttons.map((btn) => (
        <button
          key={btn.label}
          onClick={btn.action}
          className={`h-8 shrink-0 rounded px-2 text-xs font-medium transition-colors ${
            btn.isActive()
              ? "bg-gray-200 text-gray-900"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
}

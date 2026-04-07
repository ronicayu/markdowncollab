"use client";

import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/core";

interface ToolbarProps {
  editor: Editor | null;
  onToggleShortcutsHelp?: () => void;
}

interface ToolbarButton {
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: () => boolean;
  separator?: boolean;
}

function formatShortcut(shortcut: string, mac: boolean): string {
  return shortcut
    .replace(/Mod/g, mac ? "\u2318" : "Ctrl")
    .replace(/Alt/g, mac ? "\u2325" : "Alt")
    .replace(/Shift/g, mac ? "\u21E7" : "Shift");
}

export default function Toolbar({ editor, onToggleShortcutsHelp }: ToolbarProps) {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  if (!editor) return null;

  const buttons: ToolbarButton[] = [
    {
      label: "Bold",
      shortcut: "Mod+B",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "Italic",
      shortcut: "Mod+I",
      icon: <span className="text-sm font-serif italic font-bold">I</span>,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "Underline",
      shortcut: "Mod+U",
      icon: <span className="text-sm font-serif underline font-bold">U</span>,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive("underline"),
    },
    {
      label: "Strikethrough",
      shortcut: "Mod+Shift+S",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 6.5C15 5 13.2 4 11 4c-2.8 0-5 1.8-5 4.5 0 1.2.5 2.2 1.3 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 17.5C9 19 10.8 20 13 20c2.8 0 5-1.8 5-4.5 0-1-.3-2-.9-2.7" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
    },
    {
      label: "Highlight",
      shortcut: "Mod+Shift+H",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          <path strokeLinecap="round" d="M3 21h18" stroke="currentColor" strokeWidth={2.5} style={{ color: '#facc15' }} />
        </svg>
      ),
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive("highlight"),
    },
    {
      label: "Inline code",
      shortcut: "Mod+E",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
      separator: true,
    },
    {
      label: "Heading 1",
      shortcut: "Mod+Alt+1",
      icon: <span className="text-xs font-bold tracking-tight">H1</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive("heading", { level: 1 }),
    },
    {
      label: "Heading 2",
      shortcut: "Mod+Alt+2",
      icon: <span className="text-xs font-bold tracking-tight">H2</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Heading 3",
      shortcut: "Mod+Alt+3",
      icon: <span className="text-xs font-bold tracking-tight">H3</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive("heading", { level: 3 }),
      separator: true,
    },
    {
      label: "Align left",
      shortcut: "Mod+Shift+L",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M3 10h12M3 14h18M3 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
    },
    {
      label: "Align center",
      shortcut: "Mod+Shift+E",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M6 10h12M3 14h18M6 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
    },
    {
      label: "Align right",
      shortcut: "Mod+Shift+R",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M9 10h12M3 14h18M9 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      separator: true,
    },
    {
      label: "Bullet list",
      shortcut: "Mod+Shift+8",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" d="M9 7h10M9 12h10M9 17h10" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
    },
    {
      label: "Ordered list",
      shortcut: "Mod+Shift+7",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h10M9 12h10M9 17h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h1M4 12h1M4 17h1" />
          <text x="3.5" y="8" fontSize="5" fill="currentColor" stroke="none">1</text>
          <text x="3.5" y="13" fontSize="5" fill="currentColor" stroke="none">2</text>
          <text x="3.5" y="18" fontSize="5" fill="currentColor" stroke="none">3</text>
        </svg>
      ),
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive("orderedList"),
    },
    {
      label: "Outdent",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4L3 8l4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().liftListItem('listItem').run(),
      isActive: () => false,
    },
    {
      label: "Indent",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4l4 4-4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().sinkListItem('listItem').run(),
      isActive: () => false,
    },
    {
      label: "Blockquote",
      shortcut: "Mod+Shift+B",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
    },
    {
      label: "Code block",
      shortcut: "Mod+Alt+C",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-3 3 3 3M15 9l3 3-3 3" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive("codeBlock"),
    },
    {
      label: "Mermaid diagram",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          {/* Simplified flowchart icon */}
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <rect x="2" y="17" width="7" height="4" rx="1" />
          <rect x="15" y="17" width="7" height="4" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v5M12 11l-4.5 6M12 11l4.5 6" />
        </svg>
      ),
      action: () => {
        // Insert a fresh mermaid code block node with starter content.
        // We can't use setCodeBlock().insertContent() because setCodeBlock
        // wraps the current paragraph (including its text), and insertContent
        // then appends onto that existing text, producing garbled syntax.
        // Instead, insert the complete node at the current position so the
        // existing paragraph is not disturbed.
        const { state } = editor;
        const { $from } = state.selection;
        // If already inside a mermaid block, do nothing.
        if ($from.parent.type.name === "codeBlock" && $from.parent.attrs.language === "mermaid") return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "codeBlock",
            attrs: { language: "mermaid" },
            content: [{ type: "text", text: "graph TD\n  A[Start] --> B[End]" }],
          })
          .run();
      },
      isActive: () => editor.isActive("codeBlock", { language: "mermaid" }),
      separator: true,
    },
    {
      label: "Horizontal rule",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M4 12h16" />
        </svg>
      ),
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
    },
    {
      label: "Table",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path strokeLinecap="round" d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      ),
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      isActive: () => editor.isActive("table"),
      separator: true,
    },
    {
      label: "Undo",
      shortcut: "Mod+Z",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
    },
    {
      label: "Redo",
      shortcut: "Mod+Shift+Z",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 6l4 4-4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
      separator: true,
    },
    {
      label: "Find & Replace",
      shortcut: "Mod+F",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      ),
      action: () => {
        // Dispatch synthetic Cmd+F to trigger the global handler in Editor
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true }));
      },
      isActive: () => false,
      separator: true,
    },
  ];

  return (
    <div className="sticky top-0 z-10 border-b border-gray-200 bg-white relative">
    <div className="flex items-center gap-0.5 overflow-x-auto px-3 py-1.5 scrollbar-none">
      {buttons.map((btn, i) => (
        <div key={btn.label} className="flex items-center">
          {btn.separator && i > 0 && (
            <div className="w-px h-5 bg-gray-200 mx-1.5" />
          )}
          <button
            onClick={btn.action}
            title={btn.shortcut ? `${btn.label} (${formatShortcut(btn.shortcut, isMac)})` : btn.label}
            className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
              btn.isActive()
                ? "bg-[#B8692A]/10 text-[#B8692A]"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            {btn.icon}
          </button>
        </div>
      ))}
      {/* Separator before help button */}
      <div className="w-px h-5 bg-gray-200 mx-1.5" />
      <button
        onClick={onToggleShortcutsHelp}
        title={`Keyboard shortcuts (${isMac ? "\u2318" : "Ctrl"}+/)`}
        className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      </button>
    </div>
    {/* Scroll fade hint for mobile */}
    <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none" />
    </div>
  );
}

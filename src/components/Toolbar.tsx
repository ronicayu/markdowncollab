"use client";

import type { Editor } from "@tiptap/core";

interface ToolbarProps {
  editor: Editor | null;
}

interface ToolbarButton {
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: () => boolean;
  separator?: boolean;
}

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export default function Toolbar({ editor }: ToolbarProps) {
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
  ];

  return (
    <div className="sticky top-0 z-10 flex items-center gap-0.5 overflow-x-auto border-b border-gray-200 bg-white px-3 py-1.5">
      {buttons.map((btn, i) => (
        <div key={btn.label} className="flex items-center">
          {btn.separator && i > 0 && (
            <div className="w-px h-5 bg-gray-200 mx-1.5" />
          )}
          <button
            onClick={btn.action}
            title={btn.shortcut ? `${btn.label} (${btn.shortcut.replace(/Mod/g, isMac ? "\u2318" : "Ctrl")})` : btn.label}
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
    </div>
  );
}

"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";

interface MobileToolbarProps {
  editor: Editor | null;
}

interface MobileToolbarCategory {
  name: string;
  buttons: {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    isActive: () => boolean;
  }[];
}

export default function MobileToolbar({ editor }: MobileToolbarProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!editor) return null;

  // Quick access bar buttons (most essential 8)
  const quickButtons = [
    {
      label: "Bold",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "Italic",
      icon: <span className="text-base font-serif italic font-bold">I</span>,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "Heading",
      icon: <span className="text-sm font-bold tracking-tight">H</span>,
      action: () => {
        // Cycle through headings: normal -> H1 -> H2 -> H3 -> normal
        if (editor.isActive("heading", { level: 3 })) {
          editor.chain().focus().setParagraph().run();
        } else if (editor.isActive("heading", { level: 2 })) {
          editor.chain().focus().toggleHeading({ level: 3 }).run();
        } else if (editor.isActive("heading", { level: 1 })) {
          editor.chain().focus().toggleHeading({ level: 2 }).run();
        } else {
          editor.chain().focus().toggleHeading({ level: 1 }).run();
        }
      },
      isActive: () => editor.isActive("heading"),
    },
    {
      label: "List",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
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
      label: "Link",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      action: () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
      },
      isActive: () => editor.isActive("link"),
    },
    {
      label: "Undo",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
    },
    {
      label: "Redo",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 6l4 4-4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
    },
  ];

  // Full categorized buttons for the bottom sheet
  const categories: MobileToolbarCategory[] = [
    {
      name: "Text",
      buttons: [
        {
          label: "Bold",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" /></svg>,
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: () => editor.isActive("bold"),
        },
        {
          label: "Italic",
          icon: <span className="text-base font-serif italic font-bold">I</span>,
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: () => editor.isActive("italic"),
        },
        {
          label: "Underline",
          icon: <span className="text-base font-serif underline font-bold">U</span>,
          action: () => editor.chain().focus().toggleUnderline().run(),
          isActive: () => editor.isActive("underline"),
        },
        {
          label: "Strike",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 6.5C15 5 13.2 4 11 4c-2.8 0-5 1.8-5 4.5 0 1.2.5 2.2 1.3 3" /><path strokeLinecap="round" strokeLinejoin="round" d="M8 17.5C9 19 10.8 20 13 20c2.8 0 5-1.8 5-4.5 0-1-.3-2-.9-2.7" /></svg>,
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive("strike"),
        },
        {
          label: "Superscript",
          icon: <span className="text-xs font-bold">x<sup className="text-[9px]">2</sup></span>,
          action: () => editor.chain().focus().toggleSuperscript().run(),
          isActive: () => editor.isActive("superscript"),
        },
        {
          label: "Subscript",
          icon: <span className="text-xs font-bold">x<sub className="text-[9px]">2</sub></span>,
          action: () => editor.chain().focus().toggleSubscript().run(),
          isActive: () => editor.isActive("subscript"),
        },
        {
          label: "Code",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" /></svg>,
          action: () => editor.chain().focus().toggleCode().run(),
          isActive: () => editor.isActive("code"),
        },
        {
          label: "Link",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1" /></svg>,
          action: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })); },
          isActive: () => editor.isActive("link"),
        },
      ],
    },
    {
      name: "Headings",
      buttons: [
        {
          label: "H1",
          icon: <span className="text-sm font-bold">H1</span>,
          action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          isActive: () => editor.isActive("heading", { level: 1 }),
        },
        {
          label: "H2",
          icon: <span className="text-sm font-bold">H2</span>,
          action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          isActive: () => editor.isActive("heading", { level: 2 }),
        },
        {
          label: "H3",
          icon: <span className="text-sm font-bold">H3</span>,
          action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          isActive: () => editor.isActive("heading", { level: 3 }),
        },
      ],
    },
    {
      name: "Alignment",
      buttons: [
        {
          label: "Left",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" d="M3 6h18M3 10h12M3 14h18M3 18h12" /></svg>,
          action: () => editor.chain().focus().setTextAlign('left').run(),
          isActive: () => editor.isActive({ textAlign: 'left' }),
        },
        {
          label: "Center",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" d="M3 6h18M6 10h12M3 14h18M6 18h12" /></svg>,
          action: () => editor.chain().focus().setTextAlign('center').run(),
          isActive: () => editor.isActive({ textAlign: 'center' }),
        },
        {
          label: "Right",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" d="M3 6h18M9 10h12M3 14h18M9 18h12" /></svg>,
          action: () => editor.chain().focus().setTextAlign('right').run(),
          isActive: () => editor.isActive({ textAlign: 'right' }),
        },
      ],
    },
    {
      name: "Lists",
      buttons: [
        {
          label: "Bullet",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" /><path strokeLinecap="round" d="M9 7h10M9 12h10M9 17h10" /></svg>,
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: () => editor.isActive("bulletList"),
        },
        {
          label: "Ordered",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h10M9 12h10M9 17h10" /><text x="3.5" y="8" fontSize="5" fill="currentColor" stroke="none">1</text><text x="3.5" y="13" fontSize="5" fill="currentColor" stroke="none">2</text><text x="3.5" y="18" fontSize="5" fill="currentColor" stroke="none">3</text></svg>,
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: () => editor.isActive("orderedList"),
        },
        {
          label: "Task",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><rect x="3" y="5" width="4" height="4" rx="0.5" /><path strokeLinecap="round" d="M4.5 7l1 1 2-2" strokeWidth={1.5} /><path strokeLinecap="round" d="M11 7h10" /><rect x="3" y="14" width="4" height="4" rx="0.5" /><path strokeLinecap="round" d="M11 16h10" /></svg>,
          action: () => editor.chain().focus().toggleTaskList().run(),
          isActive: () => editor.isActive("taskList"),
        },
        {
          label: "Outdent",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 4L3 8l4 4" /></svg>,
          action: () => editor.chain().focus().liftListItem('listItem').run(),
          isActive: () => false,
        },
        {
          label: "Indent",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 4l4 4-4 4" /></svg>,
          action: () => editor.chain().focus().sinkListItem('listItem').run(),
          isActive: () => false,
        },
      ],
    },
    {
      name: "Blocks",
      buttons: [
        {
          label: "Quote",
          icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" /></svg>,
          action: () => editor.chain().focus().toggleBlockquote().run(),
          isActive: () => editor.isActive("blockquote"),
        },
        {
          label: "Code Block",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><rect x="2" y="4" width="20" height="16" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-3 3 3 3M15 9l3 3-3 3" /></svg>,
          action: () => editor.chain().focus().toggleCodeBlock().run(),
          isActive: () => editor.isActive("codeBlock"),
        },
        {
          label: "Mermaid",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5"><rect x="8" y="2" width="8" height="4" rx="1" /><rect x="2" y="17" width="7" height="4" rx="1" /><rect x="15" y="17" width="7" height="4" rx="1" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v5M12 11l-4.5 6M12 11l4.5 6" /></svg>,
          action: () => {
            const { state } = editor;
            const { $from } = state.selection;
            if ($from.parent.type.name === "codeBlock" && $from.parent.attrs.language === "mermaid") return;
            editor.chain().focus().insertContent({
              type: "codeBlock",
              attrs: { language: "mermaid" },
              content: [{ type: "text", text: "graph TD\n  A[Start] --> B[End]" }],
            }).run();
          },
          isActive: () => editor.isActive("codeBlock", { language: "mermaid" }),
        },
        {
          label: "Horizontal Rule",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" d="M4 12h16" /></svg>,
          action: () => editor.chain().focus().setHorizontalRule().run(),
          isActive: () => false,
        },
        {
          label: "Table",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><rect x="3" y="3" width="18" height="18" rx="1" /><path strokeLinecap="round" d="M3 9h18M3 15h18M9 3v18M15 3v18" /></svg>,
          action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
          isActive: () => editor.isActive("table"),
        },
      ],
    },
    {
      name: "Advanced",
      buttons: [
        {
          label: "Undo",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" /><path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" /></svg>,
          action: () => editor.chain().focus().undo().run(),
          isActive: () => false,
        },
        {
          label: "Redo",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h4" /><path strokeLinecap="round" strokeLinejoin="round" d="M17 6l4 4-4 4" /></svg>,
          action: () => editor.chain().focus().redo().run(),
          isActive: () => false,
        },
        {
          label: "Find",
          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" /></svg>,
          action: () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true })); },
          isActive: () => false,
        },
      ],
    },
  ];

  return (
    <>
      {/* Fixed bottom bar - mobile only */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-black/10 mobile-toolbar-bar"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-1 py-1">
          {quickButtons.map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              aria-label={btn.label}
              aria-pressed={btn.isActive() ? "true" : "false"}
              className={`mobile-touch-target shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                btn.isActive()
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[var(--text-secondary)] active:bg-[var(--card-hover-bg)]"
              }`}
            >
              {btn.icon}
            </button>
          ))}
          {/* More button */}
          <button
            onClick={() => setSheetOpen(true)}
            aria-label="More formatting options"
            className="mobile-touch-target shrink-0 rounded-lg flex items-center justify-center text-[var(--text-secondary)] active:bg-[var(--card-hover-bg)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <circle cx="12" cy="5" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom sheet - full toolbar */}
      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 mobile-sheet-backdrop"
            onClick={() => setSheetOpen(false)}
          />
          {/* Sheet */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-[var(--toolbar-bg)] rounded-t-2xl shadow-2xl mobile-sheet-panel max-h-[70vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-[var(--toolbar-border)] rounded-full" />
            </div>
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 pb-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">All Tools</span>
              <button
                onClick={() => setSheetOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Categories */}
            <div className="px-4 pb-4 space-y-4">
              {categories.map((cat) => (
                <div key={cat.name}>
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{cat.name}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {cat.buttons.map((btn) => (
                      <button
                        key={btn.label}
                        onClick={() => {
                          btn.action();
                          // Don't close sheet for toggle-type actions so user can see state
                        }}
                        aria-label={btn.label}
                        aria-pressed={btn.isActive() ? "true" : "false"}
                        className={`mobile-touch-target flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                          btn.isActive()
                            ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                            : "text-[var(--text-secondary)] active:bg-[var(--card-hover-bg)]"
                        }`}
                      >
                        {btn.icon}
                        <span className="text-[10px] leading-none">{btn.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

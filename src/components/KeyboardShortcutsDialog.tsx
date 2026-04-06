"use client";

import { useEffect, useState } from "react";

interface ShortcutEntry {
  keys: string; // Uses "Mod" as placeholder for Cmd/Ctrl
  action: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_DATA: ShortcutCategory[] = [
  {
    title: "Text Formatting",
    shortcuts: [
      { keys: "Mod+B", action: "Bold" },
      { keys: "Mod+I", action: "Italic" },
      { keys: "Mod+U", action: "Underline" },
      { keys: "Mod+E", action: "Inline code" },
      { keys: "Mod+Shift+X", action: "Strikethrough" },
    ],
  },
  {
    title: "Blocks",
    shortcuts: [
      { keys: "Mod+Alt+1", action: "Heading 1" },
      { keys: "Mod+Alt+2", action: "Heading 2" },
      { keys: "Mod+Alt+3", action: "Heading 3" },
      { keys: "Mod+Alt+4", action: "Heading 4" },
      { keys: "Mod+Alt+5", action: "Heading 5" },
      { keys: "Mod+Alt+6", action: "Heading 6" },
      { keys: "Mod+Shift+7", action: "Ordered list" },
      { keys: "Mod+Shift+8", action: "Bullet list" },
      { keys: "Mod+Shift+9", action: "Blockquote" },
      { keys: "Mod+Alt+C", action: "Code block" },
      { keys: "/", action: "Slash command menu" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "Mod+F", action: "Find" },
      { keys: "Mod+H", action: "Find & Replace" },
      { keys: "Mod+Z", action: "Undo" },
      { keys: "Mod+Shift+Z", action: "Redo" },
      { keys: "Tab", action: "Indent list" },
      { keys: "Shift+Tab", action: "Outdent list" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Mod+/", action: "Show this help" },
      { keys: "Escape", action: "Close dialog / search" },
    ],
  },
];

function formatKey(key: string, isMac: boolean): string {
  return key
    .replace(/Mod/g, isMac ? "\u2318" : "Ctrl")
    .replace(/Alt/g, isMac ? "\u2325" : "Alt")
    .replace(/Shift/g, isMac ? "\u21E7" : "Shift");
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({
  open,
  onClose,
}: KeyboardShortcutsDialogProps) {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      data-testid="shortcuts-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl mx-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_DATA.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm text-gray-700">
                      {shortcut.action}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {formatKey(shortcut.keys, isMac)
                        .split("+")
                        .map((part, i) => (
                          <kbd
                            key={i}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md"
                          >
                            {part}
                          </kbd>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

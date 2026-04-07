"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getKeybindings,
  getCustomizedActions,
  setKeybinding,
  resetKeybindings,
  DEFAULT_KEYBINDINGS,
} from "@/lib/keybindings";

interface ShortcutEntry {
  keys: string;
  action: string;
  actionId?: string; // maps to keybinding action key
}

interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

const SHORTCUT_DATA: ShortcutCategory[] = [
  {
    title: "Text Formatting",
    shortcuts: [
      { keys: "Mod+B", action: "Bold", actionId: "bold" },
      { keys: "Mod+I", action: "Italic", actionId: "italic" },
      { keys: "Mod+U", action: "Underline", actionId: "underline" },
      { keys: "Mod+E", action: "Inline code", actionId: "inline-code" },
      { keys: "Mod+Shift+X", action: "Strikethrough", actionId: "strikethrough" },
      { keys: "Mod+Shift+H", action: "Highlight", actionId: "highlight" },
      { keys: "Mod+K", action: "Insert link", actionId: "link" },
    ],
  },
  {
    title: "Blocks",
    shortcuts: [
      { keys: "Mod+Alt+1", action: "Heading 1", actionId: "heading-1" },
      { keys: "Mod+Alt+2", action: "Heading 2", actionId: "heading-2" },
      { keys: "Mod+Alt+3", action: "Heading 3", actionId: "heading-3" },
      { keys: "Mod+Alt+4", action: "Heading 4", actionId: "heading-4" },
      { keys: "Mod+Alt+5", action: "Heading 5", actionId: "heading-5" },
      { keys: "Mod+Alt+6", action: "Heading 6", actionId: "heading-6" },
      { keys: "Mod+Shift+7", action: "Ordered list", actionId: "ordered-list" },
      { keys: "Mod+Shift+8", action: "Bullet list", actionId: "bullet-list" },
      { keys: "Mod+Shift+9", action: "Blockquote", actionId: "blockquote" },
      { keys: "Mod+Alt+C", action: "Code block", actionId: "code-block" },
      { keys: "/", action: "Slash command menu" },
    ],
  },
  {
    title: "Alignment",
    shortcuts: [
      { keys: "Mod+Shift+L", action: "Align left", actionId: "align-left" },
      { keys: "Mod+Shift+E", action: "Align center", actionId: "align-center" },
      { keys: "Mod+Shift+R", action: "Align right", actionId: "align-right" },
    ],
  },
  {
    title: "Lists",
    shortcuts: [
      { keys: "Tab", action: "Indent list item" },
      { keys: "Shift+Tab", action: "Outdent list item" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "Mod+F", action: "Find", actionId: "find" },
      { keys: "Mod+H", action: "Find & Replace", actionId: "find-replace" },
      { keys: "Mod+Z", action: "Undo", actionId: "undo" },
      { keys: "Mod+Shift+Z", action: "Redo", actionId: "redo" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Mod+P", action: "Command palette", actionId: "command-palette" },
      { keys: "Mod+/", action: "Show this help", actionId: "shortcuts-help" },
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

function keyComboFromEvent(e: KeyboardEvent, isMac: boolean): string | null {
  // Ignore bare modifier keys
  if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  let key = e.key;
  // Normalize key names
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
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
  const [customizeMode, setCustomizeMode] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [bindings, setBindings] = useState(getKeybindings);
  const [customized, setCustomized] = useState(getCustomizedActions);
  const listeningRef = useRef(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
  }, []);

  // Refresh bindings when dialog opens
  useEffect(() => {
    if (open) {
      setBindings(getKeybindings());
      setCustomized(getCustomizedActions());
    } else {
      setCustomizeMode(false);
      setEditingActionId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (editingActionId) {
          setEditingActionId(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, editingActionId]);

  // Listen for key combo when editing
  useEffect(() => {
    if (!editingActionId) {
      listeningRef.current = false;
      return;
    }
    listeningRef.current = true;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listeningRef.current) return;
      if (e.key === "Escape") return; // handled above
      e.preventDefault();
      e.stopPropagation();

      const combo = keyComboFromEvent(e, isMac);
      if (!combo) return;

      setKeybinding(editingActionId, combo);
      setBindings(getKeybindings());
      setCustomized(getCustomizedActions());
      setEditingActionId(null);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editingActionId, isMac]);

  const handleReset = useCallback(() => {
    resetKeybindings();
    setBindings(getKeybindings());
    setCustomized(getCustomizedActions());
    setEditingActionId(null);
  }, []);

  if (!open) return null;

  function getDisplayKeys(shortcut: ShortcutEntry): string {
    if (shortcut.actionId && bindings[shortcut.actionId]) {
      return bindings[shortcut.actionId];
    }
    return shortcut.keys;
  }

  return (
    <div
      data-testid="shortcuts-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="bg-white rounded-xl shadow-xl mx-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between rounded-t-xl">
          <h2 id="shortcuts-dialog-title" className="text-base font-semibold text-gray-900">
            Keyboard Shortcuts
          </h2>
          <div className="flex items-center gap-2">
            {customizeMode && customized.size > 0 && (
              <button
                onClick={handleReset}
                className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
              >
                Reset all
              </button>
            )}
            <button
              onClick={() => {
                setCustomizeMode((v) => !v);
                setEditingActionId(null);
              }}
              className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                customizeMode
                  ? "bg-[#B8692A] text-white"
                  : "text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {customizeMode ? "Done" : "Customize"}
            </button>
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
        </div>
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_DATA.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {category.title}
              </h3>
              <div className="space-y-1">
                {category.shortcuts.map((shortcut) => {
                  const isCustomized = shortcut.actionId ? customized.has(shortcut.actionId) : false;
                  const isEditing = editingActionId === shortcut.actionId;
                  const canCustomize = customizeMode && !!shortcut.actionId;
                  const displayKeys = getDisplayKeys(shortcut);

                  return (
                    <div
                      key={shortcut.action}
                      className={`flex items-center justify-between py-1.5 px-1.5 rounded transition-colors ${
                        isEditing
                          ? "bg-amber-50 ring-1 ring-[#B8692A]"
                          : canCustomize
                          ? "hover:bg-gray-50 cursor-pointer"
                          : ""
                      }`}
                      onClick={() => {
                        if (canCustomize && shortcut.actionId) {
                          setEditingActionId(
                            editingActionId === shortcut.actionId ? null : shortcut.actionId
                          );
                        }
                      }}
                    >
                      <span
                        className={`text-sm ${
                          isCustomized ? "text-[#B8692A] font-semibold" : "text-gray-700"
                        }`}
                      >
                        {shortcut.action}
                      </span>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <span className="text-xs text-[#B8692A] font-medium animate-pulse">
                            Press new shortcut...
                          </span>
                        ) : (
                          <div className="flex items-center gap-0.5">
                            {formatKey(displayKeys, isMac)
                              .split("+")
                              .map((part, i) => (
                                <kbd
                                  key={i}
                                  className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium rounded-md border ${
                                    isCustomized
                                      ? "text-[#B8692A] bg-amber-50 border-amber-200"
                                      : "text-gray-600 bg-gray-50 border-gray-200"
                                  }`}
                                >
                                  {part}
                                </kbd>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

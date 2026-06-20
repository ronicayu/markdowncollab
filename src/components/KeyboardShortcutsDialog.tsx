"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getKeybindings,
  getCustomizedActions,
  setKeybinding,
  resetKeybindings,
  findConflict,
  syncOverridesToServer,
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
  overlayMode?: boolean;
}

export default function KeyboardShortcutsDialog({
  open,
  onClose,
  overlayMode = false,
}: KeyboardShortcutsDialogProps) {
  const [isMac, setIsMac] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [bindings, setBindings] = useState(getKeybindings);
  const [customized, setCustomized] = useState(getCustomizedActions);
  const [conflictWarning, setConflictWarning] = useState<{
    combo: string;
    conflictAction: string;
    pendingAction: string;
  } | null>(null);
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
      setConflictWarning(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // In overlay mode, dismiss on any keypress
      if (overlayMode) {
        e.preventDefault();
        onClose();
        return;
      }
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
  }, [open, onClose, editingActionId, overlayMode]);

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

      // Check for conflicts before saving
      const conflict = findConflict(combo, editingActionId);
      if (conflict) {
        setConflictWarning({
          combo,
          conflictAction: conflict,
          pendingAction: editingActionId,
        });
        return; // Don't save yet — user must confirm
      }

      setKeybinding(editingActionId, combo);
      syncOverridesToServer();
      setBindings(getKeybindings());
      setCustomized(getCustomizedActions());
      setEditingActionId(null);
      setConflictWarning(null);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [editingActionId, isMac]);

  // Accept a conflicting binding — override anyway
  const acceptConflict = useCallback(() => {
    if (!conflictWarning) return;
    setKeybinding(conflictWarning.pendingAction, conflictWarning.combo);
    syncOverridesToServer();
    setBindings(getKeybindings());
    setCustomized(getCustomizedActions());
    setEditingActionId(null);
    setConflictWarning(null);
  }, [conflictWarning]);

  // Cancel a conflicting binding — go back to editing
  const cancelConflict = useCallback(() => {
    setConflictWarning(null);
  }, []);

  const handleReset = useCallback(() => {
    resetKeybindings();
    syncOverridesToServer();
    setBindings(getKeybindings());
    setCustomized(getCustomizedActions());
    setEditingActionId(null);
    setConflictWarning(null);
  }, []);

  if (!open) return null;

  function getDisplayKeys(shortcut: ShortcutEntry): string {
    if (shortcut.actionId && bindings[shortcut.actionId]) {
      return bindings[shortcut.actionId];
    }
    return shortcut.keys;
  }

  // Overlay mode: full-screen semi-transparent cheat sheet
  if (overlayMode) {
    return (
      <div
        data-testid="shortcuts-overlay"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      >
        <div className="max-w-5xl w-full mx-8 pointer-events-none">
          <h2 className="text-center text-2xl font-bold text-white/90 mb-8">
            Keyboard Shortcuts
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {SHORTCUT_DATA.map((category) => (
              <div key={category.title}>
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                  {category.title}
                </h3>
                <div className="space-y-2">
                  {category.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.action}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm text-white/70">{shortcut.action}</span>
                      <div className="flex items-center gap-0.5 ml-3">
                        {formatKey(getDisplayKeys(shortcut), isMac)
                          .split("+")
                          .map((part, i) => (
                            <kbd
                              key={i}
                              className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-medium rounded-md border text-white/80 bg-white/10 border-white/20"
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
          <p className="text-center text-xs text-white/30 mt-8">
            Press any key to dismiss
          </p>
        </div>
      </div>
    );
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
        <div className="sticky top-0 bg-white border-b border-[rgba(0,0,0,0.1)] px-5 py-4 flex items-center justify-between rounded-t-xl">
          <h2 id="shortcuts-dialog-title" className="text-base font-semibold text-[#31302e]">
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
                  ? "bg-[#0075de] text-white"
                  : "text-[#615d59] hover:text-[#31302e] border border-[rgba(0,0,0,0.1)] hover:border-[#dddddd]"
              }`}
            >
              {customizeMode ? "Done" : "Customize"}
            </button>
            <button
              onClick={onClose}
              className="text-[#a39e98] hover:text-[#615d59] transition-colors"
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
        {conflictWarning && (
          <div className="mx-5 mt-3 p-3 bg-[#fbece0] border border-[rgba(221,91,0,0.3)] rounded-lg">
            <p className="text-sm text-[#dd5b00] font-medium">
              Conflict detected
            </p>
            <p className="text-xs text-[#dd5b00] mt-1">
              <kbd className="px-1 py-0.5 bg-[#fbece0] border border-[rgba(221,91,0,0.5)] rounded text-xs font-mono">
                {formatKey(conflictWarning.combo, isMac)}
              </kbd>{" "}
              is already bound to{" "}
              <strong>{conflictWarning.conflictAction.replace(/-/g, " ")}</strong>.
            </p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={acceptConflict}
                className="text-xs px-2 py-1 bg-[#0075de] text-white rounded hover:bg-[#9a5722] transition-colors"
              >
                Override anyway
              </button>
              <button
                onClick={cancelConflict}
                className="text-xs px-2 py-1 border border-[#dddddd] text-[#615d59] rounded hover:bg-[#f6f5f4] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div className="px-5 py-4 space-y-5">
          {SHORTCUT_DATA.map((category) => (
            <div key={category.title}>
              <h3 className="text-xs font-semibold text-[#a39e98] uppercase tracking-wider mb-2">
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
                          ? "bg-[#fbece0] ring-1 ring-[#0075de]"
                          : canCustomize
                          ? "hover:bg-[#f6f5f4] cursor-pointer"
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
                          isCustomized ? "text-[#0075de] font-semibold" : "text-[#31302e]"
                        }`}
                      >
                        {shortcut.action}
                      </span>
                      <div className="flex items-center gap-1">
                        {isEditing ? (
                          <span className="text-xs text-[#0075de] font-medium animate-pulse">
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
                                      ? "text-[#0075de] bg-[#fbece0] border-[rgba(221,91,0,0.3)]"
                                      : "text-[#615d59] bg-[#f6f5f4] border-[rgba(0,0,0,0.1)]"
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

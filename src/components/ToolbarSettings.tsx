"use client";

import { useState, useEffect, useRef } from "react";

export const TOOLBAR_SECTIONS = [
  { id: "formatting", label: "Formatting", description: "Bold, Italic, Underline, Strike, Superscript, Subscript, Highlight, Text color, Link, Inline code" },
  { id: "headings", label: "Headings", description: "H1, H2, H3" },
  { id: "alignment", label: "Alignment", description: "Left, Center, Right" },
  { id: "lists", label: "Lists", description: "Bullet, Ordered, Task, Outdent, Indent" },
  { id: "blocks", label: "Blocks", description: "Blockquote, Code, Mermaid, Emoji, HR, Table" },
  { id: "history", label: "History", description: "Undo, Redo" },
  { id: "search", label: "Search", description: "Find & Replace" },
  { id: "advanced", label: "Advanced", description: "Auto-number, Snippet, Highlight, Macros, Shortcuts" },
] as const;

export type ToolbarSectionId = (typeof TOOLBAR_SECTIONS)[number]["id"];

const STORAGE_KEY = "toolbarHidden";

export function getHiddenSections(): Set<ToolbarSectionId> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();
    return new Set(JSON.parse(stored) as ToolbarSectionId[]);
  } catch {
    return new Set();
  }
}

function saveHiddenSections(hidden: Set<ToolbarSectionId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    // storage full
  }
}

interface ToolbarSettingsProps {
  open: boolean;
  onClose: () => void;
  onChange: (hidden: Set<ToolbarSectionId>) => void;
}

export default function ToolbarSettings({ open, onClose, onChange }: ToolbarSettingsProps) {
  const [hidden, setHidden] = useState<Set<ToolbarSectionId>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setHidden(getHiddenSections());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onClose]);

  if (!open) return null;

  function toggleSection(id: ToolbarSectionId) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      saveHiddenSections(next);
      onChange(next);
      return next;
    });
  }

  function resetToDefault() {
    const empty = new Set<ToolbarSectionId>();
    setHidden(empty);
    saveHiddenSections(empty);
    onChange(empty);
  }

  return (
    <div
      ref={dialogRef}
      className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 w-72"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Toolbar Sections</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close toolbar settings"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-3">Show or hide toolbar button groups.</p>
      <div className="space-y-2">
        {TOOLBAR_SECTIONS.map((section) => (
          <label
            key={section.id}
            className="flex items-start gap-2.5 cursor-pointer group"
          >
            <input
              type="checkbox"
              checked={!hidden.has(section.id)}
              onChange={() => toggleSection(section.id)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A]"
            />
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                {section.label}
              </span>
              <p className="text-[11px] text-gray-400 leading-tight">
                {section.description}
              </p>
            </div>
          </label>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={resetToDefault}
          className="w-full text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded py-1.5 transition-colors"
        >
          Reset to default
        </button>
      </div>
    </div>
  );
}

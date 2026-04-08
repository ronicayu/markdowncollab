"use client";

import { useEffect, useState, useRef, useCallback } from "react";

const STORAGE_KEY = "markdown-collab-scratchpad";

export default function Scratchpad() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setContent(saved);
  }, []);

  // Save to localStorage on content change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, content);
  }, [content]);

  // Keyboard shortcut: Cmd+Shift+N
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "N") {
      e.preventDefault();
      setOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-focus textarea when opened
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111110] text-white">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
          <span className="text-sm font-medium">Scratchpad</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-white/40 hidden sm:inline">Cmd+Shift+N</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-white/50 hover:text-white transition-colors rounded"
            aria-label="Close scratchpad"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Quick notes... (persists across pages)"
        className="flex-1 p-3 text-sm text-gray-700 resize-none outline-none min-h-[200px] max-h-[400px] bg-[#FFFEF9]"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-[10px] text-gray-400">
        <span>{content.length} chars</span>
        <button
          onClick={() => { if (confirm("Clear scratchpad?")) setContent(""); }}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

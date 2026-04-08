"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";

interface Heading {
  level: number;
  text: string;
  pos: number;
}

interface Backlink {
  id: string;
  title: string;
  snippet: string;
}

interface Bookmark {
  name: string;
  scrollTop: number;
}

function getBookmarks(docId: string): Bookmark[] {
  try {
    const raw = localStorage.getItem(`bookmarks:${docId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(docId: string, bookmarks: Bookmark[]) {
  try {
    localStorage.setItem(`bookmarks:${docId}`, JSON.stringify(bookmarks));
  } catch {
    // storage full
  }
}

interface OutlineSidebarProps {
  editor: Editor | null;
  documentId?: string;
}

function computeHeadingNumbers(headings: Heading[]): string[] {
  const numbers: string[] = [];
  const counters: number[] = [0, 0, 0, 0, 0, 0]; // h1-h6

  for (const h of headings) {
    const level = h.level; // 1-based
    const idx = level - 1;
    counters[idx]++;
    // Reset all deeper levels
    for (let j = idx + 1; j < counters.length; j++) {
      counters[j] = 0;
    }
    // Build number string from the first non-zero level to current level
    const parts: number[] = [];
    for (let j = 0; j <= idx; j++) {
      parts.push(counters[j] || 0);
    }
    numbers.push(parts.join(".") + ".");
  }

  return numbers;
}

export default function OutlineSidebar({ editor, documentId }: OutlineSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showAddBookmark, setShowAddBookmark] = useState(false);
  const [bookmarkName, setBookmarkName] = useState("");
  const bookmarkInputRef = useRef<HTMLInputElement>(null);
  const [showNumbering, setShowNumbering] = useState(false);

  // Load numbering preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("outline-numbering");
      if (stored === "true") setShowNumbering(true);
    } catch {}
  }, []);

  const headingNumbers = showNumbering ? computeHeadingNumbers(headings) : [];

  // Load bookmarks from localStorage
  useEffect(() => {
    if (!documentId) return;
    setBookmarks(getBookmarks(documentId));
  }, [documentId]);

  const addBookmark = useCallback(() => {
    if (!documentId || !bookmarkName.trim()) return;
    // Get the scroll position of the editor's scroll container
    const editorEl = document.querySelector(".ProseMirror")?.parentElement;
    const scrollTop = editorEl?.scrollTop ?? 0;
    const newBookmarks = [...bookmarks, { name: bookmarkName.trim(), scrollTop }];
    setBookmarks(newBookmarks);
    saveBookmarks(documentId, newBookmarks);
    setBookmarkName("");
    setShowAddBookmark(false);
  }, [documentId, bookmarkName, bookmarks]);

  const removeBookmark = useCallback((index: number) => {
    if (!documentId) return;
    const newBookmarks = bookmarks.filter((_, i) => i !== index);
    setBookmarks(newBookmarks);
    saveBookmarks(documentId, newBookmarks);
  }, [documentId, bookmarks]);

  const scrollToBookmark = useCallback((bookmark: Bookmark) => {
    const editorEl = document.querySelector(".ProseMirror")?.parentElement;
    if (editorEl) {
      editorEl.scrollTo({ top: bookmark.scrollTop, behavior: "smooth" });
    }
  }, []);

  // Fetch backlinks on mount
  useEffect(() => {
    if (!documentId) return;
    fetch(`/api/documents/${documentId}/backlinks`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setBacklinks(data);
      })
      .catch(() => {});
  }, [documentId]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    editor.on("update", updateHeadings);
    updateHeadings();

    return () => {
      editor.off("update", updateHeadings);
    };
  }, [editor]);

  if (collapsed) {
    return (
      <div className="border-r border-[#E8D8C0] bg-[#F5EBD8] p-2 flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
          title="Show outline"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-[#E8D8C0] bg-[#F5EBD8] p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 tracking-widest">OUTLINE</p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const next = !showNumbering;
              setShowNumbering(next);
              try { localStorage.setItem("outline-numbering", String(next)); } catch {}
            }}
            className={`p-1 rounded-md transition-colors ${
              showNumbering
                ? "text-amber-600 bg-amber-100 hover:bg-amber-200"
                : "text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0]"
            }`}
            title={showNumbering ? "Hide numbering" : "Show numbering"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
            title="Hide outline"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>
      {headings.length === 0 ? (
        <p className="text-xs text-gray-400">No headings yet</p>
      ) : (
        <div className="space-y-0.5">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                if (!editor) return;
                editor.commands.setTextSelection(h.pos + 1);
                const editorDom = editor.view.dom;
                const headingTag = `h${h.level}`;
                const headingEls = editorDom.querySelectorAll(headingTag);
                let matched: Element | null = null;
                headingEls.forEach((el) => {
                  if (el.textContent?.trim() === h.text.trim() && !matched) {
                    matched = el;
                  }
                });
                if (matched) {
                  (matched as Element).scrollIntoView({ behavior: "smooth", block: "center" });
                } else {
                  editor.commands.scrollIntoView();
                }
              }}
              className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 truncate py-1.5 px-2 rounded-md hover:bg-[#E8D8C0] transition-colors"
              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
            >
              {showNumbering && headingNumbers[i] ? (
                <span className="text-gray-400 mr-1 text-xs font-mono">{headingNumbers[i]}</span>
              ) : null}
              {h.text}
            </button>
          ))}
        </div>
      )}
      {/* Bookmarks section */}
      {documentId && (
        <div className="mt-6 pt-4 border-t border-[#E8D8C0]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 tracking-widest">BOOKMARKS</p>
            <button
              onClick={() => {
                setShowAddBookmark((v) => !v);
                setTimeout(() => bookmarkInputRef.current?.focus(), 50);
              }}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
              title="Add bookmark"
              aria-label="Add bookmark"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          {showAddBookmark && (
            <div className="flex items-center gap-1 mb-2">
              <input
                ref={bookmarkInputRef}
                type="text"
                placeholder="Bookmark name..."
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addBookmark(); if (e.key === "Escape") setShowAddBookmark(false); }}
                className="flex-1 min-w-0 text-xs border border-[#E8D8C0] rounded px-1.5 py-1 bg-white/50 outline-none focus:border-gray-400"
              />
              <button
                onClick={addBookmark}
                disabled={!bookmarkName.trim()}
                className="text-xs text-gray-500 hover:text-gray-700 px-1.5 py-1 rounded hover:bg-[#E8D8C0] disabled:opacity-40"
              >
                Add
              </button>
            </div>
          )}
          {bookmarks.length === 0 && !showAddBookmark ? (
            <p className="text-xs text-gray-400">No bookmarks</p>
          ) : (
            <div className="space-y-0.5">
              {bookmarks.map((bm, i) => (
                <div key={i} className="flex items-center group">
                  <button
                    onClick={() => scrollToBookmark(bm)}
                    className="flex-1 text-left text-sm text-gray-600 hover:text-gray-900 truncate py-1.5 px-2 rounded-md hover:bg-[#E8D8C0] transition-colors"
                    title={`Scroll to "${bm.name}"`}
                  >
                    {bm.name}
                  </button>
                  <button
                    onClick={() => removeBookmark(i)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-all"
                    title="Remove bookmark"
                    aria-label={`Remove bookmark ${bm.name}`}
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {backlinks.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#E8D8C0]">
          <p className="text-xs font-semibold text-gray-400 tracking-widest mb-2">LINKED FROM</p>
          <div className="space-y-1">
            {backlinks.map((bl) => (
              <a
                key={bl.id}
                href={`/doc/${bl.id}`}
                className="block text-sm text-gray-600 hover:text-gray-900 py-1.5 px-2 rounded-md hover:bg-[#E8D8C0] transition-colors truncate"
                title={bl.snippet || bl.title}
              >
                {bl.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

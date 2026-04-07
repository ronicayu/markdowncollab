"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

interface Document {
  id: string;
  title: string;
  updatedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<Document[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch documents when opening
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    setLoading(true);
    fetch("/api/documents")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.documents ?? [];
        setDocs(list);
      })
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = docs.filter((doc) => {
    if (!query) return true;
    return doc.title.toLowerCase().includes(query.toLowerCase());
  });

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.querySelector("[data-selected='true']") as HTMLElement;
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navigate = useCallback(
    (doc: Document) => {
      onClose();
      router.push(`/doc/${doc.id}`);
    },
    [onClose, router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const doc = filtered[selectedIndex];
        if (doc) navigate(doc);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, navigate, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--dialog-bg)] rounded-xl shadow-2xl border border-[var(--card-border)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--toolbar-border)]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-5 w-5 text-[var(--text-muted)] shrink-0"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search documents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none text-sm"
          />
          <kbd className="hidden sm:inline-block text-xs text-[var(--text-muted)] bg-[var(--input-bg)] border border-[var(--input-border)] rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {loading && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
              Loading...
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
              {docs.length === 0
                ? "No documents found"
                : "No matching documents"}
            </p>
          )}
          {!loading &&
            filtered.map((doc, i) => (
              <button
                key={doc.id}
                data-selected={i === selectedIndex ? "true" : "false"}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => navigate(doc)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  i === selectedIndex
                    ? "bg-amber-50 dark:bg-amber-900/20"
                    : "hover:bg-[var(--card-hover-bg)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {doc.title || "Untitled"}
                </span>
                <span className="text-xs text-[var(--text-muted)] shrink-0 ml-3">
                  Updated {timeAgo(doc.updatedAt)}
                </span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

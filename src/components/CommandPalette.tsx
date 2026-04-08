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

type PaletteTab = "documents" | "commands" | "settings";

const SLASH_COMMANDS = [
  { id: "h1", label: "Heading 1", description: "Large section heading", icon: "H1" },
  { id: "h2", label: "Heading 2", description: "Medium section heading", icon: "H2" },
  { id: "h3", label: "Heading 3", description: "Small section heading", icon: "H3" },
  { id: "bullet", label: "Bullet List", description: "Unordered list", icon: "\u2022" },
  { id: "ordered", label: "Ordered List", description: "Numbered list", icon: "1." },
  { id: "todo", label: "Task List", description: "Interactive checklist", icon: "\u2611" },
  { id: "quote", label: "Blockquote", description: "Quote or callout", icon: "\u275D" },
  { id: "code", label: "Code Block", description: "Fenced code block", icon: "</>" },
  { id: "mermaid", label: "Mermaid Diagram", description: "Flowcharts, sequences, and more", icon: "\u25C7" },
  { id: "table", label: "Table", description: "Insert a 3x3 table", icon: "\u25A6" },
  { id: "image", label: "Image", description: "Upload an image", icon: "\uD83D\uDDBC" },
  { id: "link", label: "Link", description: "Insert a hyperlink", icon: "\uD83D\uDD17" },
  { id: "divider", label: "Divider", description: "Horizontal rule", icon: "\u2014" },
  { id: "toc", label: "Table of Contents", description: "Auto-generated from headings", icon: "\uD83D\uDCD1" },
  { id: "embed", label: "Embed Video", description: "YouTube or Loom video embed", icon: "\uD83C\uDFAC" },
  { id: "math", label: "Math Equation", description: "LaTeX math block (KaTeX)", icon: "\u03A3" },
  { id: "details", label: "Collapsible Section", description: "Expandable details block", icon: "\u25B6" },
  { id: "callout", label: "Callout", description: "Info callout block", icon: "\u2139\uFE0F" },
  { id: "date", label: "Date", description: "Insert today's date", icon: "\uD83D\uDCC5" },
  { id: "time", label: "Time", description: "Insert current time", icon: "\uD83D\uDD50" },
  { id: "columns", label: "Two Columns", description: "Side-by-side layout", icon: "\u258B\u258F" },
  { id: "toggle", label: "Toggle List", description: "Collapsible list items", icon: "\u25B7" },
  { id: "emoji", label: "Emoji", description: "Insert an emoji character", icon: "\uD83D\uDE00" },
];

const SETTINGS_ITEMS = [
  { id: "theme", label: "Theme", description: "Change the color theme", icon: "\uD83C\uDFA8", action: "theme" },
  { id: "language", label: "Language", description: "Change the interface language", icon: "\uD83C\uDF10", action: "language" },
  { id: "toolbar", label: "Toolbar Customization", description: "Customize toolbar actions", icon: "\uD83D\uDD27", action: "toolbar" },
];

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
  const [activeTab, setActiveTab] = useState<PaletteTab>("documents");
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Fetch documents when opening
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    setActiveTab("documents");
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

  // Filtered items based on active tab
  const filteredDocs = docs.filter((doc) => {
    if (!query) return true;
    return doc.title.toLowerCase().includes(query.toLowerCase());
  });

  const filteredCommands = SLASH_COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q) || cmd.id.toLowerCase().includes(q);
  });

  const filteredSettings = SETTINGS_ITEMS.filter((item) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const currentListLength =
    activeTab === "documents" ? filteredDocs.length :
    activeTab === "commands" ? filteredCommands.length :
    filteredSettings.length;

  // Reset selection when filter or tab changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab]);

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

  const handleCommandSelect = useCallback(
    (cmd: typeof SLASH_COMMANDS[0]) => {
      const commandText = `/${cmd.id}`;
      navigator.clipboard.writeText(commandText).then(() => {
        setCopiedCommand(cmd.id);
        setTimeout(() => setCopiedCommand(null), 1500);
      }).catch(() => {});
      // If we're on a doc page, navigate to editor
      if (window.location.pathname.startsWith("/doc/")) {
        onClose();
      }
    },
    [onClose],
  );

  const handleSettingSelect = useCallback(
    (item: typeof SETTINGS_ITEMS[0]) => {
      onClose();
      // Click the relevant button in the TopBar
      if (item.action === "theme") {
        const themeBtn = document.querySelector('[aria-label="Theme"]') as HTMLButtonElement;
        if (themeBtn) themeBtn.click();
      } else if (item.action === "language") {
        const langBtn = document.querySelector('[aria-label*="Language"], [title*="Language"]') as HTMLButtonElement;
        if (langBtn) langBtn.click();
      }
    },
    [onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, currentListLength - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeTab === "documents") {
          const doc = filteredDocs[selectedIndex];
          if (doc) navigate(doc);
        } else if (activeTab === "commands") {
          const cmd = filteredCommands[selectedIndex];
          if (cmd) handleCommandSelect(cmd);
        } else {
          const item = filteredSettings[selectedIndex];
          if (item) handleSettingSelect(item);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault();
        const tabs: PaletteTab[] = ["documents", "commands", "settings"];
        const idx = tabs.indexOf(activeTab);
        setActiveTab(tabs[(idx + 1) % tabs.length]);
      }
    },
    [activeTab, filteredDocs, filteredCommands, filteredSettings, selectedIndex, currentListLength, navigate, handleCommandSelect, handleSettingSelect, onClose],
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
        {/* Tab bar */}
        <div className="flex border-b border-[var(--toolbar-border)]">
          {([
            { key: "documents" as PaletteTab, label: "Documents" },
            { key: "commands" as PaletteTab, label: "Commands" },
            { key: "settings" as PaletteTab, label: "Settings" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedIndex(0); }}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-[var(--text-primary)] border-b-2 border-amber-500 bg-amber-50/50 dark:bg-amber-900/10"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--card-hover-bg)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
            placeholder={
              activeTab === "documents" ? "Search documents..." :
              activeTab === "commands" ? "Search commands..." :
              "Search settings..."
            }
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
          {/* Documents tab */}
          {activeTab === "documents" && (
            <>
              {loading && (
                <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                  Loading...
                </p>
              )}
              {!loading && filteredDocs.length === 0 && (
                <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                  {docs.length === 0
                    ? "No documents found"
                    : "No matching documents"}
                </p>
              )}
              {!loading &&
                filteredDocs.map((doc, i) => (
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
            </>
          )}

          {/* Commands tab */}
          {activeTab === "commands" && (
            <>
              {filteredCommands.length === 0 && (
                <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                  No matching commands
                </p>
              )}
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.id}
                  data-selected={i === selectedIndex ? "true" : "false"}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => handleCommandSelect(cmd)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : "hover:bg-[var(--card-hover-bg)]"
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[var(--input-bg)] flex items-center justify-center text-xs shrink-0">
                    {cmd.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] block truncate">
                      {cmd.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] block truncate">
                      {cmd.description}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] shrink-0">
                    {copiedCommand === cmd.id ? "Copied!" : `/${cmd.id}`}
                  </span>
                </button>
              ))}
            </>
          )}

          {/* Settings tab */}
          {activeTab === "settings" && (
            <>
              {filteredSettings.length === 0 && (
                <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
                  No matching settings
                </p>
              )}
              {filteredSettings.map((item, i) => (
                <button
                  key={item.id}
                  data-selected={i === selectedIndex ? "true" : "false"}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onClick={() => handleSettingSelect(item)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex
                      ? "bg-amber-50 dark:bg-amber-900/20"
                      : "hover:bg-[var(--card-hover-bg)]"
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-[var(--input-bg)] flex items-center justify-center text-xs shrink-0">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[var(--text-primary)] block truncate">
                      {item.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] block truncate">
                      {item.description}
                    </span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--toolbar-border)] flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
          <span><kbd className="px-1 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">Tab</kbd> Switch tabs</span>
          <span><kbd className="px-1 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">&uarr;&darr;</kbd> Navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-[var(--input-bg)] border border-[var(--input-border)]">Enter</kbd> Select</span>
        </div>
      </div>
    </div>
  );
}

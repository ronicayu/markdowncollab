"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { parseEmbedUrl } from "@/extensions/embed-block";
import { STATUS_BADGE_OPTIONS } from "@/extensions/status-badge";

interface LinkedDoc {
  id: string;
  title: string;
}

function DocSearchDropdown({
  position,
  onSelect,
  onClose,
}: {
  position: { top: number; left: number };
  onSelect: (doc: LinkedDoc) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<LinkedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data: LinkedDoc[]) => {
        setDocs(data.map((d) => ({ id: d.id, title: d.title || "Untitled" })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return docs;
    const q = query.toLowerCase();
    return docs.filter((d) => d.title.toLowerCase().includes(q));
  }, [docs, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, selectedIndex, onSelect, onClose]);

  return (
    <div
      style={{
        position: "fixed",
        top: position.top + 4,
        left: position.left,
        zIndex: 1001,
      }}
      className="w-72 bg-white rounded-xl shadow-lg border border-[rgba(0,0,0,0.1)] py-1 overflow-hidden"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-2 border-b border-[rgba(0,0,0,0.1)]">
        <input
          ref={inputRef}
          type="text"
          placeholder="Search documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full text-sm bg-transparent outline-none placeholder:text-[#a39e98]"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-[#a39e98] px-3 py-3 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-[#a39e98] px-3 py-3 text-center">No documents found</p>
        ) : (
          filtered.map((doc, i) => (
            <button
              key={doc.id}
              data-selected={i === selectedIndex ? "true" : "false"}
              onMouseEnter={() => setSelectedIndex(i)}
              onClick={() => onSelect(doc)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIndex ? "bg-[#fbece0]" : "hover:bg-[#f6f5f4]"
              }`}
            >
              <span className="w-5 h-5 rounded bg-[#f6f5f4] flex items-center justify-center text-xs text-[#615d59] shrink-0">
                #
              </span>
              <span className="truncate text-[#31302e]">{doc.title}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const STORAGE_KEY = "slashCommandUsage";

function getUsageCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function incrementUsage(commandId: string) {
  const counts = getUsageCounts();
  counts[commandId] = (counts[commandId] || 0) + 1;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

interface Command {
  id: string;
  label: string;
  description: string;
  icon: string;
  keywords: string[];
  action: (editor: Editor) => void;
  /** If true, the command opens an async sub-menu (e.g. doc search) */
  hasSubmenu?: boolean;
}

const COMMANDS: Command[] = [
  {
    id: "h1",
    label: "Heading 1",
    description: "Large section heading",
    icon: "H1",
    keywords: ["h1", "heading", "title"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Heading 2",
    description: "Medium section heading",
    icon: "H2",
    keywords: ["h2", "heading", "subtitle"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Heading 3",
    description: "Small section heading",
    icon: "H3",
    keywords: ["h3", "heading"],
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: "bullet",
    label: "Bullet List",
    description: "Unordered list",
    icon: "•",
    keywords: ["bullet", "list", "ul", "unordered"],
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "ordered",
    label: "Ordered List",
    description: "Numbered list",
    icon: "1.",
    keywords: ["ordered", "list", "ol", "numbered"],
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "todo",
    label: "Task List",
    description: "Interactive checklist",
    icon: "☑",
    keywords: ["todo", "task", "checklist", "checkbox"],
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "quote",
    label: "Blockquote",
    description: "Quote or callout",
    icon: "❝",
    keywords: ["quote", "blockquote", "callout"],
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "code",
    label: "Code Block",
    description: "Fenced code block",
    icon: "</>",
    keywords: ["code", "block", "pre"],
    action: (editor) => editor.chain().focus().setNode("codeBlock").run(),
  },
  {
    id: "mermaid",
    label: "Mermaid Diagram",
    description: "Flowcharts, sequences, and more",
    icon: "◇",
    keywords: ["mermaid", "diagram", "chart", "flow"],
    action: (editor) =>
      editor.chain().focus().setNode("mermaidBlock", { content: "graph LR\n  A --> B" }).run(),
  },
  {
    id: "plantuml",
    label: "PlantUML Diagram",
    description: "UML diagrams via PlantUML",
    icon: "\uD83C\uDF31",
    keywords: ["plantuml", "uml", "diagram", "sequence", "class"],
    action: (editor) =>
      editor.chain().focus().setNode("codeBlock", { language: "plantuml" }).insertContent("@startuml\nAlice -> Bob: Hello\n@enduml").run(),
  },
  {
    id: "link",
    label: "Link",
    description: "Insert a hyperlink",
    icon: "\uD83D\uDD17",
    keywords: ["link", "url", "href", "hyperlink"],
    action: () => {
      // Trigger the Cmd+K shortcut handler in Editor to open the link dialog
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
    },
  },
  {
    id: "link-doc",
    label: "Link to Document",
    description: "Insert a [[wiki-link]] to another document",
    icon: "[[",
    keywords: ["link", "doc", "wiki", "document", "cross", "reference"],
    hasSubmenu: true,
    action: () => {
      // Action is handled by the submenu; this is a no-op placeholder
    },
  },
  {
    id: "divider",
    label: "Divider",
    description: "Horizontal rule",
    icon: "—",
    keywords: ["divider", "hr", "rule", "line"],
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    id: "image",
    label: "Image",
    description: "Upload an image",
    icon: "\uD83D\uDDBC",
    keywords: ["image", "picture", "photo", "upload", "img"],
    action: (editor) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        // Extract document ID from URL: /doc/{id}
        const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
        if (!docId) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`/api/documents/${docId}/upload`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            console.error("Upload failed");
            return;
          }
          const data = await res.json();
          editor.chain().focus().setImage({ src: data.url }).run();
        } catch (err) {
          console.error("Upload error:", err);
        }
      };
      input.click();
    },
  },
  {
    id: "table",
    label: "Table",
    description: "Insert a 3x3 table",
    icon: "▦",
    keywords: ["table", "grid", "spreadsheet"],
    action: (editor) =>
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "embed",
    label: "Embed Video",
    description: "YouTube or Loom video embed",
    icon: "\u{1F3AC}",
    keywords: ["embed", "video", "youtube", "loom", "iframe"],
    action: (editor) => {
      const url = window.prompt("Paste a YouTube or Loom URL:");
      if (!url) return;
      const result = parseEmbedUrl(url);
      if (result) {
        editor
          .chain()
          .focus()
          .insertContent({
            type: "embedBlock",
            attrs: { src: result.embedUrl, provider: result.provider },
          })
          .run();
      } else {
        window.alert("Unsupported URL. Please paste a YouTube or Loom link.");
      }
    },
  },
  {
    id: "emoji",
    label: "Emoji",
    description: "Insert an emoji character",
    icon: "\u{1F600}",
    keywords: ["emoji", "smiley", "face", "reaction"],
    action: () => {
      // Trigger the emoji picker via toolbar button click
      const emojiBtn = document.querySelector('button[aria-label="Emoji"]') as HTMLButtonElement;
      if (emojiBtn) emojiBtn.click();
    },
  },
  {
    id: "toc",
    label: "Table of Contents",
    description: "Auto-generated from headings",
    icon: "\u{1F4D1}",
    keywords: ["toc", "table of contents", "outline", "headings", "navigation"],
    action: (editor) =>
      editor.chain().focus().insertContent({ type: "tocBlock" }).run(),
  },
  {
    id: "callout",
    label: "Callout",
    description: "Info callout block",
    icon: "\u2139\uFE0F",
    keywords: ["callout", "admonition", "info", "note"],
    action: (editor) =>
      (editor.commands as unknown as { setCallout: (attrs: { type: string }) => boolean }).setCallout({ type: "info" }),
  },
  {
    id: "warning",
    label: "Warning",
    description: "Warning callout block",
    icon: "\u26A0\uFE0F",
    keywords: ["warning", "caution", "alert"],
    action: (editor) =>
      (editor.commands as unknown as { setCallout: (attrs: { type: string }) => boolean }).setCallout({ type: "warning" }),
  },
  {
    id: "tip",
    label: "Tip",
    description: "Tip callout block",
    icon: "\uD83D\uDCA1",
    keywords: ["tip", "hint", "suggestion"],
    action: (editor) =>
      (editor.commands as unknown as { setCallout: (attrs: { type: string }) => boolean }).setCallout({ type: "tip" }),
  },
  {
    id: "danger",
    label: "Danger",
    description: "Danger callout block",
    icon: "\uD83D\uDEA8",
    keywords: ["danger", "error", "critical", "important"],
    action: (editor) =>
      (editor.commands as unknown as { setCallout: (attrs: { type: string }) => boolean }).setCallout({ type: "danger" }),
  },
  {
    id: "date",
    label: "Date",
    description: "Insert today's date",
    icon: "\uD83D\uDCC5",
    keywords: ["date", "today", "day"],
    action: (editor) => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      editor.chain().focus().insertContent(`${yyyy}-${mm}-${dd}`).run();
    },
  },
  {
    id: "time",
    label: "Time",
    description: "Insert current time",
    icon: "\uD83D\uDD50",
    keywords: ["time", "clock", "now"],
    action: (editor) => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const h = hours % 12 || 12;
      editor.chain().focus().insertContent(`${h}:${minutes} ${ampm}`).run();
    },
  },
  {
    id: "datetime",
    label: "Date & Time",
    description: "Insert date and time",
    icon: "\uD83D\uDCC5\uD83D\uDD50",
    keywords: ["datetime", "date", "time", "now", "timestamp"],
    action: (editor) => {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const ampm = hours >= 12 ? "PM" : "AM";
      const h = hours % 12 || 12;
      editor.chain().focus().insertContent(`${yyyy}-${mm}-${dd} ${h}:${minutes} ${ampm}`).run();
    },
  },
  {
    id: "date-picker",
    label: "Date Picker",
    description: "Insert an editable date picker",
    icon: "\uD83D\uDCC6",
    keywords: ["date-picker", "datepicker", "calendar", "pick", "editable"],
    action: (editor) => {
      const today = new Date().toISOString().slice(0, 10);
      editor.chain().focus().insertContent({
        type: "inlineDate",
        attrs: { date: today },
      }).run();
    },
  },
  {
    id: "columns",
    label: "Two Columns",
    description: "Side-by-side layout",
    icon: "\u258B\u258F",
    keywords: ["columns", "layout", "side", "split", "two"],
    action: (editor) =>
      (editor.commands as unknown as { setColumns: () => boolean }).setColumns(),
  },
  {
    id: "math",
    label: "Math Equation",
    description: "LaTeX math block (KaTeX)",
    icon: "\u03A3",
    keywords: ["math", "latex", "equation", "formula", "katex"],
    action: (editor) =>
      editor.chain().focus().insertContent({ type: "mathBlock", attrs: { content: "" } }).run(),
  },
  {
    id: "details",
    label: "Collapsible Section",
    description: "Expandable details block",
    icon: "\u25B6",
    keywords: ["details", "collapse", "collapsible", "toggle", "accordion", "expand"],
    action: (editor) =>
      editor.chain().focus().insertContent({ type: "detailsBlock", attrs: { summary: "Details", body: "" } }).run(),
  },
  {
    id: "toggle",
    label: "Toggle List",
    description: "Collapsible list items",
    icon: "\u25B7",
    keywords: ["toggle", "collapse", "collapsible", "faq", "accordion"],
    action: (editor) =>
      (editor.commands as unknown as { insertToggleList: () => boolean }).insertToggleList(),
  },
  {
    id: "status-todo",
    label: "Status: To Do",
    description: "Gray status badge",
    icon: "\u25CF",
    keywords: ["status", "badge", "todo", "to do"],
    action: (editor) =>
      (editor.commands as unknown as { insertStatusBadge: (attrs: { label: string; color: string }) => boolean }).insertStatusBadge({ label: STATUS_BADGE_OPTIONS[0].label, color: STATUS_BADGE_OPTIONS[0].color }),
  },
  {
    id: "status-progress",
    label: "Status: In Progress",
    description: "Blue status badge",
    icon: "\u25CF",
    keywords: ["status", "badge", "progress", "in progress"],
    action: (editor) =>
      (editor.commands as unknown as { insertStatusBadge: (attrs: { label: string; color: string }) => boolean }).insertStatusBadge({ label: STATUS_BADGE_OPTIONS[1].label, color: STATUS_BADGE_OPTIONS[1].color }),
  },
  {
    id: "status-done",
    label: "Status: Done",
    description: "Green status badge",
    icon: "\u25CF",
    keywords: ["status", "badge", "done", "complete"],
    action: (editor) =>
      (editor.commands as unknown as { insertStatusBadge: (attrs: { label: string; color: string }) => boolean }).insertStatusBadge({ label: STATUS_BADGE_OPTIONS[2].label, color: STATUS_BADGE_OPTIONS[2].color }),
  },
  {
    id: "status-blocked",
    label: "Status: Blocked",
    description: "Red status badge",
    icon: "\u25CF",
    keywords: ["status", "badge", "blocked"],
    action: (editor) =>
      (editor.commands as unknown as { insertStatusBadge: (attrs: { label: string; color: string }) => boolean }).insertStatusBadge({ label: STATUS_BADGE_OPTIONS[3].label, color: STATUS_BADGE_OPTIONS[3].color }),
  },
  {
    id: "status-review",
    label: "Status: Needs Review",
    description: "Amber status badge",
    icon: "\u25CF",
    keywords: ["status", "badge", "review", "needs review"],
    action: (editor) =>
      (editor.commands as unknown as { insertStatusBadge: (attrs: { label: string; color: string }) => boolean }).insertStatusBadge({ label: STATUS_BADGE_OPTIONS[4].label, color: STATUS_BADGE_OPTIONS[4].color }),
  },
  {
    id: "footnote",
    label: "Footnote",
    description: "Insert a footnote reference",
    icon: "\u00B9",
    keywords: ["footnote", "note", "reference", "cite"],
    action: (editor) => {
      // Count existing footnotes in the document to determine the next number
      const docText = editor.state.doc.textContent;
      const superscripts = ["\u00B9", "\u00B2", "\u00B3", "\u2074", "\u2075", "\u2076", "\u2077", "\u2078", "\u2079"];
      // Count footnote entries at the bottom (lines starting with a number + period)
      const footnoteMatches = docText.match(/\n\d+\.\s/g);
      const nextNum = (footnoteMatches ? footnoteMatches.length : 0) + 1;
      const superscript = nextNum <= 9 ? superscripts[nextNum - 1] : `[${nextNum}]`;

      // Insert superscript at cursor position
      editor.chain().focus().insertContent(superscript).run();

      // Check if document already has a footnote divider
      const hasDivider = docText.includes("\n---\n") && /\n\d+\.\s/.test(docText);

      // Move to end of document and append footnote
      const endPos = editor.state.doc.content.size;
      editor.chain().focus().setTextSelection(endPos).run();

      if (!hasDivider && nextNum === 1) {
        // Insert divider + first footnote
        editor.chain().focus().insertContent("<p></p><hr><p>" + nextNum + ". [footnote text]</p>").run();
      } else {
        // Append footnote entry
        editor.chain().focus().insertContent("<p>" + nextNum + ". [footnote text]</p>").run();
      }
    },
  },
  {
    id: "poll",
    label: "Poll",
    description: "Create a live poll for voting",
    icon: "\uD83D\uDDF3",
    keywords: ["poll", "vote", "voting", "survey"],
    action: (editor) => {
      const question = window.prompt("Poll question:");
      if (!question) return;
      const optionsStr = window.prompt("Options (comma-separated, 2-4):");
      if (!optionsStr) return;
      const options = optionsStr.split(",").map((o) => o.trim()).filter(Boolean).slice(0, 4);
      if (options.length < 2) {
        window.alert("Please provide at least 2 options.");
        return;
      }
      const pollId = `poll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      editor
        .chain()
        .focus()
        .insertContent({
          type: "pollBlock",
          attrs: { pollId, question, options: JSON.stringify(options) },
        })
        .run();
    },
  },
  {
    id: "draw",
    label: "Drawing Canvas",
    description: "Freehand drawing canvas",
    icon: "\u{1F3A8}",
    keywords: ["draw", "canvas", "sketch", "whiteboard", "drawing"],
    action: (editor) =>
      editor.chain().focus().insertContent({ type: "canvasBlock", attrs: { dataUrl: "" } }).run(),
  },
  {
    id: "progress",
    label: "Progress Bar",
    description: "Visual progress indicator",
    icon: "\u{1F4CA}",
    keywords: ["progress", "bar", "percentage", "tracker", "completion"],
    action: (editor) => {
      const label = window.prompt("Progress bar label:", "Progress") ?? "Progress";
      const valueStr = window.prompt("Initial value (0-100):", "0") ?? "0";
      const value = Math.max(0, Math.min(100, parseInt(valueStr, 10) || 0));
      editor
        .chain()
        .focus()
        .insertContent({
          type: "progressBlock",
          attrs: { label, value, color: "#0075de" },
        })
        .run();
    },
  },
  {
    id: "breadcrumb",
    label: "Breadcrumb",
    description: "Document folder path navigation",
    icon: "\u{1F4CD}",
    keywords: ["breadcrumb", "path", "navigation", "folder"],
    action: (editor) =>
      editor.chain().focus().insertContent({ type: "breadcrumbBlock" }).run(),
  },
  {
    id: "event",
    label: "Calendar Event",
    description: "Insert a calendar event card",
    icon: "\uD83D\uDCC5",
    keywords: ["event", "calendar", "meeting", "date", "schedule"],
    action: (editor) => {
      const title = window.prompt("Event title:");
      if (!title) return;
      const date = window.prompt("Event date (YYYY-MM-DD):");
      if (!date) return;
      const time = window.prompt("Event time (optional, e.g. 2:00 PM):") ?? "";
      const description = window.prompt("Description (optional):") ?? "";
      editor
        .chain()
        .focus()
        .insertContent({
          type: "eventBlock",
          attrs: { title, date, time, description },
        })
        .run();
    },
  },
];

interface SlashCommandMenuProps {
  editor: Editor;
  query: string;
  position: { top: number; left: number };
  onClose: () => void;
}

export default function SlashCommandMenu({
  editor,
  query,
  position,
  onClose,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [usageCounts] = useState(() => getUsageCounts());
  const [showDocSearch, setShowDocSearch] = useState(false);
  // Saved position for inserting after slash cleanup
  const slashCleanupRef = useRef<{ from: number; to: number } | null>(null);

  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.startsWith(q))
    );
  });

  // Determine favorites: top 3 most-used, but only if user has used at least 3 different commands
  const { favoriteIds, hasFavorites } = useMemo(() => {
    const entries = Object.entries(usageCounts).filter(([, count]) => count > 0);
    if (entries.length < 3) return { favoriteIds: new Set<string>(), hasFavorites: false };
    entries.sort((a, b) => b[1] - a[1]);
    const top3 = entries.slice(0, 3).map(([id]) => id);
    return { favoriteIds: new Set(top3), hasFavorites: true };
  }, [usageCounts]);

  // Build display list: favorites first (if no query), then all
  const displayItems = useMemo(() => {
    if (query || !hasFavorites) return { favorites: [] as Command[], rest: filtered };
    const favorites = filtered.filter((cmd) => favoriteIds.has(cmd.id));
    const rest = filtered.filter((cmd) => !favoriteIds.has(cmd.id));
    return { favorites, rest };
  }, [filtered, query, hasFavorites, favoriteIds]);

  const allItems = useMemo(
    () => [...displayItems.favorites, ...displayItems.rest],
    [displayItems]
  );

  // Reset selected index when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.querySelector("[data-selected='true']") as HTMLElement;
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCommand(allItems[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [allItems, selectedIndex, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDocSelect = useCallback(
    (doc: LinkedDoc) => {
      // Insert [[Title]] as a link pointing to /doc/{id}
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          marks: [
            {
              type: "link",
              attrs: {
                href: `/doc/${doc.id}`,
                target: null,
                class: "wiki-link",
              },
            },
          ],
          text: `[[${doc.title}]]`,
        })
        .run();
      setShowDocSearch(false);
      onClose();
    },
    [editor, onClose]
  );

  function runCommand(cmd: Command | undefined) {
    if (!cmd) return;
    // Delete the slash + typed query from the document
    const { state } = editor;
    const { $from } = state.selection;
    const slashStart = $from.pos - query.length - 1; // -1 for the "/" itself
    editor
      .chain()
      .focus()
      .deleteRange({ from: slashStart, to: $from.pos })
      .command(({ tr, dispatch }) => {
        if (dispatch) dispatch(tr);
        return true;
      })
      .run();
    incrementUsage(cmd.id);

    // For link-doc, open the doc search submenu instead of closing
    if (cmd.id === "link-doc") {
      setShowDocSearch(true);
      return;
    }

    cmd.action(editor);
    onClose();
  }

  if (showDocSearch) {
    return (
      <DocSearchDropdown
        position={position}
        onSelect={handleDocSelect}
        onClose={() => { setShowDocSearch(false); onClose(); }}
      />
    );
  }

  // Keyboard shortcut hints for common commands
  const SHORTCUT_HINTS: Record<string, string> = {
    h1: "# ",
    h2: "## ",
    h3: "### ",
    bullet: "- ",
    ordered: "1. ",
    todo: "[] ",
    quote: "> ",
    code: "``` ",
    divider: "---",
    bold: "Cmd+B",
    italic: "Cmd+I",
  };

  // Highlight matching characters in label
  function highlightMatch(label: string, q: string): React.ReactNode {
    if (!q) return label;
    const lowerLabel = label.toLowerCase();
    const lowerQ = q.toLowerCase();
    const idx = lowerLabel.indexOf(lowerQ);
    if (idx === -1) return label;
    return (
      <>
        {label.slice(0, idx)}
        <span className="text-[#0075de] font-semibold">{label.slice(idx, idx + q.length)}</span>
        {label.slice(idx + q.length)}
      </>
    );
  }

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: position.top + 4,
    left: position.left,
    zIndex: 1000,
  };

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when menu appears
  useEffect(() => {
    // Small delay to let the DOM render
    const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={menuRef}
      style={style}
      role="listbox"
      aria-label="Slash commands"
      aria-activedescendant={allItems[selectedIndex] ? `slash-cmd-${allItems[selectedIndex].id}` : undefined}
      className="w-72 bg-white rounded-xl shadow-lg border border-[rgba(0,0,0,0.1)] py-1 overflow-hidden flex flex-col max-h-80"
      onMouseDown={(e) => e.preventDefault()} // prevent editor blur
    >
      {/* Search input */}
      <div className="px-3 pt-2 pb-1.5 border-b border-[rgba(0,0,0,0.1)] shrink-0">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search commands..."
          value={query}
          readOnly
          className="w-full text-sm bg-[#f6f5f4] rounded-md px-2.5 py-1.5 outline-none placeholder:text-[#a39e98] text-[#31302e] border border-[rgba(0,0,0,0.1)] focus:border-[#0075de] focus:ring-1 focus:ring-[#0075de]/20"
        />
      </div>
      <div className="overflow-y-auto flex-1">
      {allItems.length === 0 && (
        <div className="px-3 py-6 text-center">
          <p className="text-xs text-[#a39e98]">No commands found</p>
          <p className="text-[10px] text-[#a39e98] mt-1">Try a different search term</p>
        </div>
      )}
      {displayItems.favorites.length > 0 && (
        <>
          <div className="px-3 pt-1.5 pb-0.5">
            <p className="text-[10px] font-medium text-[#a39e98] uppercase tracking-wide">Frequently used</p>
          </div>
          {displayItems.favorites.map((cmd, i) => {
            const globalIdx = i;
            return (
              <button
                key={cmd.id}
                id={`slash-cmd-${cmd.id}`}
                role="option"
                aria-selected={globalIdx === selectedIndex}
                data-selected={globalIdx === selectedIndex ? "true" : "false"}
                onMouseEnter={() => setSelectedIndex(globalIdx)}
                onClick={() => runCommand(cmd)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  globalIdx === selectedIndex
                    ? "bg-[#fbece0]"
                    : "hover:bg-[#f6f5f4]"
                }`}
              >
                <span className="w-8 h-8 rounded-md bg-[#f6f5f4] flex items-center justify-center text-xs font-bold text-[#615d59] shrink-0">
                  {cmd.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[#31302e]">{highlightMatch(cmd.label, query)}</p>
                    {SHORTCUT_HINTS[cmd.id] && (
                      <span className="text-[9px] font-mono text-[#a39e98] bg-[#f6f5f4] px-1 py-0.5 rounded shrink-0 ml-1">{SHORTCUT_HINTS[cmd.id]}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#a39e98] truncate">{cmd.description}</p>
                </div>
              </button>
            );
          })}
          <div className="mx-3 my-1 border-t border-[rgba(0,0,0,0.1)]" />
          <div className="px-3 pt-0.5 pb-0.5">
            <p className="text-[10px] font-medium text-[#a39e98] uppercase tracking-wide">All commands</p>
          </div>
        </>
      )}
      {displayItems.rest.map((cmd, i) => {
        const globalIdx = displayItems.favorites.length + i;
        const isCustom = cmd.id.startsWith("custom-");
        return (
          <button
            key={cmd.id}
            id={`slash-cmd-${cmd.id}`}
            role="option"
            aria-selected={globalIdx === selectedIndex}
            data-selected={globalIdx === selectedIndex ? "true" : "false"}
            onMouseEnter={() => setSelectedIndex(globalIdx)}
            onClick={() => runCommand(cmd)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              globalIdx === selectedIndex
                ? "bg-[#fbece0]"
                : "hover:bg-[#f6f5f4]"
            }`}
          >
            <span className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${isCustom ? "bg-purple-100 text-purple-600" : "bg-[#f6f5f4] text-[#615d59]"}`}>
              {cmd.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-[#31302e]">{highlightMatch(cmd.label, query)}</p>
                  {isCustom && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium">custom</span>
                  )}
                </div>
                {SHORTCUT_HINTS[cmd.id] && (
                  <span className="text-[9px] font-mono text-[#a39e98] bg-[#f6f5f4] px-1 py-0.5 rounded shrink-0 ml-1">{SHORTCUT_HINTS[cmd.id]}</span>
                )}
              </div>
              <p className="text-xs text-[#a39e98] truncate">{cmd.description}</p>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}

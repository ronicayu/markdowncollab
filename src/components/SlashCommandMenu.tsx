"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { parseEmbedUrl } from "@/extensions/embed-block";

interface Command {
  id: string;
  label: string;
  description: string;
  icon: string;
  keywords: string[];
  action: (editor: Editor) => void;
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

  const filtered = COMMANDS.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.startsWith(q))
    );
  });

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
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        runCommand(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filtered, selectedIndex, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

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
    cmd.action(editor);
    onClose();
  }

  if (filtered.length === 0) {
    onClose();
    return null;
  }

  // Adjust position to stay in viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: position.top + 4,
    left: position.left,
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      role="listbox"
      aria-label="Slash commands"
      aria-activedescendant={filtered[selectedIndex] ? `slash-cmd-${filtered[selectedIndex].id}` : undefined}
      className="w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-1 overflow-y-auto max-h-72"
      onMouseDown={(e) => e.preventDefault()} // prevent editor blur
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          id={`slash-cmd-${cmd.id}`}
          role="option"
          aria-selected={i === selectedIndex}
          data-selected={i === selectedIndex ? "true" : "false"}
          onMouseEnter={() => setSelectedIndex(i)}
          onClick={() => runCommand(cmd)}
          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === selectedIndex
              ? "bg-amber-50"
              : "hover:bg-gray-50"
          }`}
        >
          <span className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
            {cmd.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{cmd.label}</p>
            <p className="text-xs text-gray-400 truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

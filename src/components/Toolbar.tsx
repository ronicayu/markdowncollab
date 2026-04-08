"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import EmojiPicker from "./EmojiPicker";
import {
  addPersonalHighlight,
  removePersonalHighlight,
  HIGHLIGHT_COLORS,
  personalHighlightPluginKey,
} from "@/extensions/personal-highlight";
import {
  loadMacros,
  saveMacro,
  deleteMacro,
  recordedKeyFromEvent,
  replayMacro,
  type RecordedKey,
  type Macro,
} from "@/lib/macros";
import ToolbarSettings, { getHiddenSections, type ToolbarSectionId } from "./ToolbarSettings";

interface ToolbarProps {
  editor: Editor | null;
  onToggleShortcutsHelp?: () => void;
}

interface ToolbarButton {
  label: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: () => boolean;
  separator?: boolean;
  section?: ToolbarSectionId;
}

function formatShortcut(shortcut: string, mac: boolean): string {
  return shortcut
    .replace(/Mod/g, mac ? "\u2318" : "Ctrl")
    .replace(/Alt/g, mac ? "\u2325" : "Alt")
    .replace(/Shift/g, mac ? "\u21E7" : "Shift");
}

const COLOR_SWATCHES = [
  { name: "Red", hex: "#dc2626" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Amber", hex: "#d97706" },
  { name: "Green", hex: "#16a34a" },
  { name: "Teal", hex: "#0d9488" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Indigo", hex: "#4f46e5" },
  { name: "Purple", hex: "#9333ea" },
  { name: "Pink", hex: "#db2777" },
  { name: "Gray", hex: "#6b7280" },
  { name: "Brown", hex: "#92400e" },
  { name: "Black", hex: "#000000" },
];

export default function Toolbar({ editor, onToggleShortcutsHelp }: ToolbarProps) {
  const [isMac, setIsMac] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [autoNumbering, setAutoNumbering] = useState(false);
  const [showSnippetSave, setShowSnippetSave] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const colorBtnRef = useRef<HTMLDivElement>(null);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const snippetBtnRef = useRef<HTMLDivElement>(null);
  const highlightBtnRef = useRef<HTMLDivElement>(null);
  const [macroRecording, setMacroRecording] = useState(false);
  const macroKeysRef = useRef<RecordedKey[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [showMacroMenu, setShowMacroMenu] = useState(false);
  const [macroPlaying, setMacroPlaying] = useState(false);
  const [showMacroName, setShowMacroName] = useState(false);
  const [macroName, setMacroName] = useState("");
  const macroBtnRef = useRef<HTMLDivElement>(null);
  const [hiddenSections, setHiddenSections] = useState<Set<ToolbarSectionId>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
    setMacros(loadMacros());
    setHiddenSections(getHiddenSections());
  }, []);

  // Load auto-numbering preference from localStorage
  useEffect(() => {
    const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
    if (!docId) return;
    const stored = localStorage.getItem(`autoNumber:${docId}`);
    if (stored === "true") {
      setAutoNumbering(true);
      // Apply class to editor container
      const editorEl = document.querySelector(".ProseMirror");
      if (editorEl) editorEl.classList.add("auto-number-headings");
    }
  }, []);

  function toggleAutoNumbering() {
    const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
    const next = !autoNumbering;
    setAutoNumbering(next);
    const editorEl = document.querySelector(".ProseMirror");
    if (editorEl) {
      if (next) {
        editorEl.classList.add("auto-number-headings");
      } else {
        editorEl.classList.remove("auto-number-headings");
      }
    }
    if (docId) {
      localStorage.setItem(`autoNumber:${docId}`, String(next));
    }
  }

  // Macro recording: capture keydown events on editor DOM
  useEffect(() => {
    if (!macroRecording || !editor) return;
    const editorEl = editor.view.dom;
    const handler = (e: Event) => {
      const ke = e as KeyboardEvent;
      macroKeysRef.current.push(recordedKeyFromEvent(ke));
    };
    editorEl.addEventListener("keydown", handler);
    return () => editorEl.removeEventListener("keydown", handler);
  }, [macroRecording, editor]);

  function startMacroRecording() {
    macroKeysRef.current = [];
    setMacroRecording(true);
  }

  function stopMacroRecording() {
    setMacroRecording(false);
    if (macroKeysRef.current.length === 0) return;
    setShowMacroName(true);
  }

  function saveMacroWithName() {
    const name = macroName.trim() || `Macro ${macros.length + 1}`;
    const macro: Macro = {
      name,
      keys: [...macroKeysRef.current],
      createdAt: new Date().toISOString(),
    };
    saveMacro(macro);
    setMacros(loadMacros());
    setMacroName("");
    setShowMacroName(false);
  }

  async function playMacroByName(name: string) {
    if (!editor || macroPlaying) return;
    const macro = macros.find((m) => m.name === name);
    if (!macro) return;
    setMacroPlaying(true);
    setShowMacroMenu(false);
    editor.commands.focus();
    await replayMacro(editor.view.dom, macro.keys);
    setMacroPlaying(false);
  }

  function handleDeleteMacro(name: string) {
    deleteMacro(name);
    setMacros(loadMacros());
  }

  // Close macro menu on outside click
  useEffect(() => {
    if (!showMacroMenu) return;
    function handleClick(e: MouseEvent) {
      if (macroBtnRef.current && !macroBtnRef.current.contains(e.target as Node)) {
        setShowMacroMenu(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showMacroMenu]);

  // Close highlight picker on outside click
  useEffect(() => {
    if (!showHighlightPicker) return;
    function handleClick(e: MouseEvent) {
      if (highlightBtnRef.current && !highlightBtnRef.current.contains(e.target as Node)) {
        setShowHighlightPicker(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showHighlightPicker]);

  // Close snippet save on outside click
  useEffect(() => {
    if (!showSnippetSave) return;
    function handleClick(e: MouseEvent) {
      if (snippetBtnRef.current && !snippetBtnRef.current.contains(e.target as Node)) {
        setShowSnippetSave(false);
        setSnippetTitle("");
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showSnippetSave]);

  async function handleSaveSnippet() {
    if (!editor || !snippetTitle.trim()) return;
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: snippetTitle.trim(), content: selectedText }),
      });
      if (res.ok) {
        setShowSnippetSave(false);
        setSnippetTitle("");
      }
    } catch {
      // silently fail
    }
  }

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    function handleClick(e: MouseEvent) {
      if (colorBtnRef.current && !colorBtnRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showColorPicker]);

  const sectionForLabel: Record<string, ToolbarSectionId> = {
    "Bold": "formatting", "Italic": "formatting", "Underline": "formatting",
    "Strikethrough": "formatting", "Superscript": "formatting", "Subscript": "formatting",
    "Highlight": "formatting", "Text color": "formatting", "Link": "formatting", "Inline code": "formatting",
    "Heading 1": "headings", "Heading 2": "headings", "Heading 3": "headings",
    "Align left": "alignment", "Align center": "alignment", "Align right": "alignment",
    "Bullet list": "lists", "Ordered list": "lists", "Task list": "lists",
    "Outdent": "lists", "Indent": "lists",
    "Blockquote": "blocks", "Code block": "blocks", "Mermaid diagram": "blocks",
    "Emoji": "blocks", "Horizontal rule": "blocks", "Table": "blocks",
    "Undo": "history", "Redo": "history",
    "Find & Replace": "search",
  };

  if (!editor) return null;

  const buttons: ToolbarButton[] = [
    {
      label: "Bold",
      shortcut: "Mod+B",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive("bold"),
    },
    {
      label: "Italic",
      shortcut: "Mod+I",
      icon: <span className="text-sm font-serif italic font-bold">I</span>,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive("italic"),
    },
    {
      label: "Underline",
      shortcut: "Mod+U",
      icon: <span className="text-sm font-serif underline font-bold">U</span>,
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive("underline"),
    },
    {
      label: "Strikethrough",
      shortcut: "Mod+Shift+S",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 6.5C15 5 13.2 4 11 4c-2.8 0-5 1.8-5 4.5 0 1.2.5 2.2 1.3 3" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 17.5C9 19 10.8 20 13 20c2.8 0 5-1.8 5-4.5 0-1-.3-2-.9-2.7" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive("strike"),
    },
    {
      label: "Superscript",
      shortcut: "Mod+.",
      icon: <span className="text-xs font-bold">x<sup className="text-[9px]">2</sup></span>,
      action: () => editor.chain().focus().toggleSuperscript().run(),
      isActive: () => editor.isActive("superscript"),
    },
    {
      label: "Subscript",
      shortcut: "Mod+,",
      icon: <span className="text-xs font-bold">x<sub className="text-[9px]">2</sub></span>,
      action: () => editor.chain().focus().toggleSubscript().run(),
      isActive: () => editor.isActive("subscript"),
    },
    {
      label: "Highlight",
      shortcut: "Mod+Shift+H",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          <path strokeLinecap="round" d="M3 21h18" stroke="currentColor" strokeWidth={2.5} style={{ color: '#facc15' }} />
        </svg>
      ),
      action: () => editor.chain().focus().toggleHighlight().run(),
      isActive: () => editor.isActive("highlight"),
    },
    {
      label: "Text color",
      icon: (
        <span className="relative text-sm font-bold leading-none">
          A
          <span
            className="absolute bottom-0 left-0.5 right-0.5 h-[3px] rounded-sm"
            style={{ backgroundColor: editor.getAttributes("textStyle").color || "#000000" }}
          />
        </span>
      ),
      action: () => setShowColorPicker((v) => !v),
      isActive: () => showColorPicker,
    },
    {
      label: "Link",
      shortcut: "Mod+K",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      action: () => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }));
      },
      isActive: () => editor.isActive("link"),
    },
    {
      label: "Inline code",
      shortcut: "Mod+E",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive("code"),
      separator: true,
    },
    {
      label: "Heading 1",
      shortcut: "Mod+Alt+1",
      icon: <span className="text-xs font-bold tracking-tight">H1</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive("heading", { level: 1 }),
    },
    {
      label: "Heading 2",
      shortcut: "Mod+Alt+2",
      icon: <span className="text-xs font-bold tracking-tight">H2</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive("heading", { level: 2 }),
    },
    {
      label: "Heading 3",
      shortcut: "Mod+Alt+3",
      icon: <span className="text-xs font-bold tracking-tight">H3</span>,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive("heading", { level: 3 }),
      separator: true,
    },
    {
      label: "Align left",
      shortcut: "Mod+Shift+L",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M3 10h12M3 14h18M3 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('left').run(),
      isActive: () => editor.isActive({ textAlign: 'left' }),
    },
    {
      label: "Align center",
      shortcut: "Mod+Shift+E",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M6 10h12M3 14h18M6 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
    },
    {
      label: "Align right",
      shortcut: "Mod+Shift+R",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M3 6h18M9 10h12M3 14h18M9 18h12" />
        </svg>
      ),
      action: () => editor.chain().focus().setTextAlign('right').run(),
      isActive: () => editor.isActive({ textAlign: 'right' }),
      separator: true,
    },
    {
      label: "Bullet list",
      shortcut: "Mod+Shift+8",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" />
          <path strokeLinecap="round" d="M9 7h10M9 12h10M9 17h10" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive("bulletList"),
    },
    {
      label: "Ordered list",
      shortcut: "Mod+Shift+7",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h10M9 12h10M9 17h10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h1M4 12h1M4 17h1" />
          <text x="3.5" y="8" fontSize="5" fill="currentColor" stroke="none">1</text>
          <text x="3.5" y="13" fontSize="5" fill="currentColor" stroke="none">2</text>
          <text x="3.5" y="18" fontSize="5" fill="currentColor" stroke="none">3</text>
        </svg>
      ),
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive("orderedList"),
    },
    {
      label: "Task list",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="3" y="5" width="4" height="4" rx="0.5" />
          <path strokeLinecap="round" d="M4.5 7l1 1 2-2" strokeWidth={1.5} />
          <path strokeLinecap="round" d="M11 7h10" />
          <rect x="3" y="14" width="4" height="4" rx="0.5" />
          <path strokeLinecap="round" d="M11 16h10" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive("taskList"),
    },
    {
      label: "Outdent",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 4L3 8l4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().liftListItem('listItem').run(),
      isActive: () => false,
    },
    {
      label: "Indent",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 7h8M11 12h8M3 17h16" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4l4 4-4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().sinkListItem('listItem').run(),
      isActive: () => false,
    },
    {
      label: "Blockquote",
      shortcut: "Mod+Shift+B",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive("blockquote"),
    },
    {
      label: "Code block",
      shortcut: "Mod+Alt+C",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l-3 3 3 3M15 9l3 3-3 3" />
        </svg>
      ),
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive("codeBlock"),
    },
    {
      label: "Mermaid diagram",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
          {/* Simplified flowchart icon */}
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <rect x="2" y="17" width="7" height="4" rx="1" />
          <rect x="15" y="17" width="7" height="4" rx="1" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v5M12 11l-4.5 6M12 11l4.5 6" />
        </svg>
      ),
      action: () => {
        // Insert a fresh mermaid code block node with starter content.
        // We can't use setCodeBlock().insertContent() because setCodeBlock
        // wraps the current paragraph (including its text), and insertContent
        // then appends onto that existing text, producing garbled syntax.
        // Instead, insert the complete node at the current position so the
        // existing paragraph is not disturbed.
        const { state } = editor;
        const { $from } = state.selection;
        // If already inside a mermaid block, do nothing.
        if ($from.parent.type.name === "codeBlock" && $from.parent.attrs.language === "mermaid") return;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "codeBlock",
            attrs: { language: "mermaid" },
            content: [{ type: "text", text: "graph TD\n  A[Start] --> B[End]" }],
          })
          .run();
      },
      isActive: () => editor.isActive("codeBlock", { language: "mermaid" }),
      separator: true,
    },
    {
      label: "Emoji",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M8 14s1.5 2 4 2 4-2 4-2" />
          <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
          <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none" />
        </svg>
      ),
      action: () => setShowEmoji((v) => !v),
      isActive: () => showEmoji,
    },
    {
      label: "Horizontal rule",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" d="M4 12h16" />
        </svg>
      ),
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: () => false,
    },
    {
      label: "Table",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path strokeLinecap="round" d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      ),
      action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
      isActive: () => editor.isActive("table"),
      separator: true,
    },
    {
      label: "Undo",
      shortcut: "Mod+Z",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 6l-4 4 4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
    },
    {
      label: "Redo",
      shortcut: "Mod+Shift+Z",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v0a5 5 0 005 5h4" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 6l4 4-4 4" />
        </svg>
      ),
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
      separator: true,
    },
    {
      label: "Find & Replace",
      shortcut: "Mod+F",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
      ),
      action: () => {
        // Dispatch synthetic Cmd+F to trigger the global handler in Editor
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true }));
      },
      isActive: () => false,
      separator: true,
    },
  ];

  const visibleButtons = buttons.filter((btn) => {
    const section = sectionForLabel[btn.label];
    return !section || !hiddenSections.has(section);
  });

  return (
    <div className="sticky top-0 z-10 border-b bg-[var(--toolbar-bg)] border-[var(--toolbar-border)] relative hidden md:block" role="toolbar" aria-label="Text formatting">
    <div className="flex items-center gap-0.5 overflow-x-auto px-3 py-1.5 scrollbar-none">
      {visibleButtons.map((btn, i) => (
        <div key={btn.label} className="flex items-center" ref={btn.label === "Text color" ? colorBtnRef : undefined}>
          {btn.separator && i > 0 && (
            <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />
          )}
          <button
            onClick={btn.action}
            title={btn.shortcut ? `${btn.label} (${formatShortcut(btn.shortcut, isMac)})` : btn.label}
            aria-label={btn.label}
            aria-pressed={btn.isActive() ? "true" : "false"}
            className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
              btn.isActive()
                ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)]"
            }`}
          >
            {btn.icon}
          </button>
          {/* Color picker dropdown */}
          {btn.label === "Text color" && showColorPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-48">
              <div className="grid grid-cols-6 gap-1.5 mb-2">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.hex}
                    title={swatch.name}
                    onClick={() => {
                      editor.chain().focus().setColor(swatch.hex).run();
                      setShowColorPicker(false);
                    }}
                    className="h-6 w-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: swatch.hex }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  editor.chain().focus().unsetColor().run();
                  setShowColorPicker(false);
                }}
                className="w-full text-xs text-center py-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
              >
                Default
              </button>
            </div>
          )}
        </div>
      ))}
      {/* Auto-number headings toggle */}
      {!hiddenSections.has("advanced") && <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />}
      {!hiddenSections.has("advanced") && (
      <button
        onClick={toggleAutoNumbering}
        title="Auto-number headings"
        aria-label="Auto-number headings"
        aria-pressed={autoNumbering ? "true" : "false"}
        className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
          autoNumbering
            ? "bg-[var(--accent)]/10 text-[var(--accent)]"
            : "text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)]"
        }`}
      >
        <span className="text-xs font-bold tracking-tight">#</span>
      </button>
      )}
      {/* Save as snippet */}
      {!hiddenSections.has("advanced") && <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />}
      {!hiddenSections.has("advanced") && <div className="relative" ref={snippetBtnRef}>
        <button
          onClick={() => {
            if (!editor) return;
            const { from, to } = editor.state.selection;
            if (from === to) return;
            setShowSnippetSave((v) => !v);
          }}
          title="Save selection as snippet"
          aria-label="Save selection as snippet"
          className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
        {showSnippetSave && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-56">
            <p className="text-xs font-medium text-gray-700 mb-2">Save as Snippet</p>
            <input
              type="text"
              placeholder="Snippet name..."
              value={snippetTitle}
              onChange={(e) => setSnippetTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveSnippet(); }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              onClick={handleSaveSnippet}
              disabled={!snippetTitle.trim()}
              className="w-full text-xs font-medium text-white bg-[#B8692A] rounded py-1.5 hover:bg-[#96541F] disabled:opacity-40 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>}
      {/* Personal highlight */}
      {!hiddenSections.has("advanced") && <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />}
      {!hiddenSections.has("advanced") && <div className="relative" ref={highlightBtnRef}>
        <button
          onClick={() => {
            if (!editor) return;
            const { from, to } = editor.state.selection;
            if (from === to) return;
            setShowHighlightPicker((v) => !v);
          }}
          title="Personal highlight (local only)"
          aria-label="Personal highlight"
          className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
            showHighlightPicker
              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)]"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        {showHighlightPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 w-40">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1 mb-1.5">Personal Highlight</p>
            <div className="flex gap-1.5 mb-2 px-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.color}
                  title={c.name}
                  onClick={() => {
                    if (!editor) return;
                    const { from, to } = editor.state.selection;
                    if (from === to) return;
                    addPersonalHighlight(editor.view, from, to, c.color);
                    setShowHighlightPicker(false);
                  }}
                  className="h-6 w-6 rounded-full border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c.bg }}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (!editor) return;
                const { from, to } = editor.state.selection;
                if (from !== to) {
                  removePersonalHighlight(editor.view, from, to);
                }
                setShowHighlightPicker(false);
              }}
              className="w-full text-xs text-center py-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
            >
              Remove
            </button>
          </div>
        )}
      </div>}
      {/* Macro record/play */}
      {!hiddenSections.has("advanced") && <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />}
      {!hiddenSections.has("advanced") && <div className="relative flex items-center gap-0.5" ref={macroBtnRef}>
        {!macroRecording ? (
          <button
            onClick={startMacroRecording}
            title="Record macro"
            aria-label="Record macro"
            className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <circle cx="12" cy="12" r="6" fill="currentColor" className="text-red-500" />
            </svg>
          </button>
        ) : (
          <button
            onClick={stopMacroRecording}
            title="Stop recording"
            aria-label="Stop recording macro"
            className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-red-500 bg-red-50 animate-pulse transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        )}
        {macros.length > 0 && (
          <button
            onClick={() => setShowMacroMenu((v) => !v)}
            disabled={macroPlaying}
            title="Play macro"
            aria-label="Play macro"
            className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </button>
        )}
        {showMacroMenu && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-2 w-48">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1 mb-1.5">Macros</p>
            {macros.map((m) => (
              <div key={m.name} className="flex items-center gap-1">
                <button
                  onClick={() => playMacroByName(m.name)}
                  className="flex-1 text-left text-sm text-gray-700 hover:bg-gray-100 rounded px-2 py-1 truncate"
                >
                  {m.name}
                </button>
                <button
                  onClick={() => handleDeleteMacro(m.name)}
                  className="text-gray-400 hover:text-red-500 p-0.5"
                  title="Delete macro"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        {showMacroName && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 w-56">
            <p className="text-xs font-medium text-gray-700 mb-2">Name this macro</p>
            <input
              type="text"
              placeholder="Macro name..."
              value={macroName}
              onChange={(e) => setMacroName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveMacroWithName(); }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 mb-2 outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              onClick={saveMacroWithName}
              className="w-full text-xs font-medium text-white bg-[#B8692A] rounded py-1.5 hover:bg-[#96541F] transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>}
      {/* Separator before help button */}
      {!hiddenSections.has("advanced") && (
      <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />
      )}
      {!hiddenSections.has("advanced") && (
      <button
        onClick={onToggleShortcutsHelp}
        title={`Keyboard shortcuts (${isMac ? "\u2318" : "Ctrl"}+/)`}
        aria-label="Keyboard shortcuts"
        className="h-9 w-9 shrink-0 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-secondary)] transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.5" fill="currentColor" />
        </svg>
      </button>
      )}
      {/* Toolbar settings gear icon */}
      <div className="w-px h-5 bg-[var(--toolbar-border)] mx-1.5" />
      <div className="relative">
        <button
          onClick={() => setShowSettings((v) => !v)}
          title="Toolbar settings"
          aria-label="Toolbar settings"
          className={`h-9 w-9 shrink-0 rounded-md flex items-center justify-center transition-colors ${
            showSettings
              ? "bg-[var(--accent)]/10 text-[var(--accent)]"
              : "text-[var(--text-muted)] hover:bg-[var(--card-hover-bg)] hover:text-[var(--text-secondary)]"
          }`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <ToolbarSettings
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onChange={setHiddenSections}
        />
      </div>
    </div>
    {/* Scroll fade hint for mobile */}
    <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--toolbar-bg)] to-transparent pointer-events-none" />
    {/* Emoji picker popover */}
    {showEmoji && (
      <div className="absolute top-full left-0 mt-1 z-50">
        <EmojiPicker
          onSelect={(emoji) => {
            editor.chain().focus().insertContent(emoji).run();
            setShowEmoji(false);
          }}
          onClose={() => setShowEmoji(false)}
        />
      </div>
    )}
    </div>
  );
}

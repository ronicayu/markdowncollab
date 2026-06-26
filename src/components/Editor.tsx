"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { RemoteCursors } from "@/extensions/remote-cursors";
import { getUserColor } from "@/lib/cursor-utils";
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { SuggestModeExtension, setSuggestModeEnabled } from "@/extensions/suggest-mode";
import type { EditorMode } from "@/lib/editor-mode";
import { CommentMark, commentDecorationKey } from "@/extensions/comment-mark";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import { TextAlign } from "@tiptap/extension-text-align";
import { Superscript } from "@tiptap/extension-superscript";
import { Subscript } from "@tiptap/extension-subscript";
import { MermaidBlock } from "@/extensions/mermaid-block";
import { TocBlock } from "@/extensions/toc-block";
import { EmbedBlock, parseEmbedUrl } from "@/extensions/embed-block";
import { MathBlock } from "@/extensions/math-block";
import { DetailsBlock } from "@/extensions/details-block";
import { ToggleList, ToggleItem } from "@/extensions/toggle-list";
import { StatusBadge } from "@/extensions/status-badge";
import { PollBlock } from "@/extensions/poll-block";
import { CanvasBlock } from "@/extensions/canvas-block";
import { EventBlock } from "@/extensions/event-block";
import "katex/dist/katex.min.css";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import SlashCommandMenu from "./SlashCommandMenu";
import { SearchReplace, searchReplacePluginKey } from "@/extensions/search-replace";
import * as TablePkg from "@tiptap/extension-table";
const { Table, TableRow, TableCell, TableHeader } = TablePkg;
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { DragHandle } from "@tiptap/extension-drag-handle";
import "./drag-handle.css";
import SearchBar from "./SearchBar";
import LinkDialog from "./LinkDialog";
import TableSortMenu from "./TableSortMenu";
import AIAutoComplete from "./AIAutoComplete";

import EditorStatusBar from "./EditorStatusBar";

import { ProgressBlock } from "@/extensions/progress-block";
import { BreadcrumbBlock } from "@/extensions/breadcrumb-block";

import { Extension } from "@tiptap/core";
import { HeadingAnchor, initAnchorScrolling } from "@/extensions/heading-anchor";
import { InlineDate } from "@/extensions/inline-date";
import { getKeybindings, toProseMirrorKey } from "@/lib/keybindings";


interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  onEditorReady?: (editor: TiptapEditor) => void;
  activeCommentId?: string | null;
  editable?: boolean;
  mode?: EditorMode;
  initialContent?: string | null;
  onToggleShortcutsHelp?: () => void;
  autoCompleteEnabled?: boolean;
}

export default function Editor({
  documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  editable = true,
  mode,
  initialContent,
  onToggleShortcutsHelp,
  autoCompleteEnabled = false,
}: EditorProps) {

  const cursorColor = useMemo(() => getUserColor(userName), [userName]);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{
    query: string;
    pos: { top: number; left: number };
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  const [wordGoal, setWordGoal] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [lastSavedByName, setLastSavedByName] = useState<string | null>(null);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [docSize, setDocSize] = useState("");
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("spellcheckEnabled");
      return stored === null ? true : stored === "true";
    } catch { return true; }
  });
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftKey = `draft:${documentId}`;
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Load typewriter mode from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`typewriterMode:${documentId}`);
      if (stored === "true") setTypewriterMode(true);
    } catch {}
  }, [documentId]);

  async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/documents/${documentId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Upload failed:", err.error);
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  }

  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: cursorColor,
    });
  }, [provider, userName, cursorColor]);

  // Load word goal from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`wordGoal:${documentId}`);
    if (stored) setWordGoal(parseInt(stored, 10));
  }, [documentId]);

  // Track save status from Yjs sync events + last editor name from awareness
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout>;
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      setSaveStatus("saving");
      clearTimeout(saveTimer);

      // Determine who made this edit from awareness states
      // Local updates have origin === null or the provider itself
      if (!origin || origin === provider) {
        // This is a local edit — the current user is the editor
        setLastSavedByName(userName);
      } else {
        // Remote edit — find the most recently active remote user from awareness
        const states = provider.awareness.getStates();
        let remoteName: string | null = null;
        states.forEach((state, clientId) => {
          if (clientId !== provider.awareness.clientID && state.user?.name) {
            remoteName = state.user.name;
          }
        });
        if (remoteName) setLastSavedByName(remoteName);
      }

      // The WS provider sends updates immediately; the server persists after a debounce.
      // Mark as "saved" after 1.5s (matches the server's save debounce).
      saveTimer = setTimeout(() => {
        setSaveStatus("saved");
        setLastSyncTime(Date.now());
      }, 1500);
    };
    ydoc.on("update", onUpdate);
    return () => { ydoc.off("update", onUpdate); clearTimeout(saveTimer); };
  }, [ydoc, provider, userName]);

  // Tick the clock every 30s so "Saved Xm ago" updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Reading progress bar: track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const maxScroll = scrollHeight - clientHeight;
    const scrollable = maxScroll > 10;
    setIsScrollable(scrollable);
    if (scrollable) {
      setScrollProgress((scrollTop / maxScroll) * 100);
    } else {
      setScrollProgress(0);
    }
    setShowScrollTop(scrollTop > 500);
  }, []);

  // Reading position memory: save scroll position (debounced 1s)
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScrollPositionSave = useCallback(() => {
    if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
    scrollSaveTimerRef.current = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      try {
        localStorage.setItem(`scrollPos:${documentId}`, String(el.scrollTop));
      } catch {
        // storage full
      }
    }, 1000);
  }, [documentId]);

  // Restore scroll position on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      try {
        const saved = localStorage.getItem(`scrollPos:${documentId}`);
        if (saved) {
          el.scrollTop = Number(saved);
        }
      } catch {
        // ignore
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [documentId]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    el.addEventListener("scroll", handleScrollPositionSave, { passive: true });
    // Check on mount and after content changes
    handleScroll();
    const observer = new ResizeObserver(handleScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      el.removeEventListener("scroll", handleScrollPositionSave);
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
      observer.disconnect();
    };
  }, [handleScroll]);

  const effectiveEditable = mode ? mode !== "view" : editable;
  const initialSuggestEnabled = mode === "suggest";

  const editor = useEditor({
    editable: effectiveEditable,
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        codeBlock: false, // replaced by MermaidBlock below
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { class: "editor-link" },
        },
      }),
      MermaidBlock,
      TocBlock,
      EmbedBlock,
      MathBlock,
      DetailsBlock,
      ToggleList,
      ToggleItem,
      StatusBadge,
      PollBlock,
      CanvasBlock,
      EventBlock,
      Placeholder.configure({
        placeholder: "Start typing, or press / for commands...",
      }),
      SuggestionMark,
      SuggestModeExtension.configure({
        initialEnabled: initialSuggestEnabled,
        authorName: userName,
        authorType: "human",
        documentId,
        ydoc,
      }),
      CommentMark,
      SearchReplace,
      Collaboration.configure({
        document: ydoc,
      }),
      Markdown.configure({
        html: true,
        transformPastedText: false,
        transformCopiedText: false,
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: "editor-table" },
      }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Superscript,
      Subscript,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      DragHandle.configure({
        render() {
          const el = document.createElement("div");
          el.className = "drag-handle";
          el.innerHTML = "⠿";
          return el;
        },
        nested: true,
      }),
      RemoteCursors.configure({
        provider,
        currentUser: userName,
      }),
      ProgressBlock,
      BreadcrumbBlock,
      HeadingAnchor,
      InlineDate,
      // Custom keybindings extension — applies user overrides via a high-priority
      // ProseMirror keymap plugin. Actions that need React state (find, link, etc.)
      // are dispatched as custom DOM events and handled in useEffect listeners.
      Extension.create({
        name: "customKeybindings",
        addKeyboardShortcuts() {
          const bindings = getKeybindings();
          const tiptapShortcuts: Record<string, () => boolean> = {};
          const editorRef = this.editor;

          const editorActionMap: Record<string, (editor: TiptapEditor) => boolean> = {
            bold: (e) => e.chain().focus().toggleBold().run(),
            italic: (e) => e.chain().focus().toggleItalic().run(),
            underline: (e) => e.chain().focus().toggleUnderline().run(),
            "inline-code": (e) => e.chain().focus().toggleCode().run(),
            strikethrough: (e) => e.chain().focus().toggleStrike().run(),
            "heading-1": (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
            "heading-2": (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
            "heading-3": (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
            "heading-4": (e) => e.chain().focus().toggleHeading({ level: 4 }).run(),
            "heading-5": (e) => e.chain().focus().toggleHeading({ level: 5 }).run(),
            "heading-6": (e) => e.chain().focus().toggleHeading({ level: 6 }).run(),
            "ordered-list": (e) => e.chain().focus().toggleOrderedList().run(),
            "bullet-list": (e) => e.chain().focus().toggleBulletList().run(),
            blockquote: (e) => e.chain().focus().toggleBlockquote().run(),
            "code-block": (e) => e.chain().focus().toggleCodeBlock().run(),
            "align-left": (e) => e.chain().focus().setTextAlign("left").run(),
            "align-center": (e) => e.chain().focus().setTextAlign("center").run(),
            "align-right": (e) => e.chain().focus().setTextAlign("right").run(),
            undo: (e) => e.chain().focus().undo().run(),
            redo: (e) => e.chain().focus().redo().run(),
          };

          // Actions that fire DOM events (handled by React useEffect listeners)
          const domEventActions = new Set([
            "find", "find-replace", "link", "command-palette", "shortcuts-help",
          ]);

          for (const [action, combo] of Object.entries(bindings)) {
            const pmKey = toProseMirrorKey(combo);
            if (editorActionMap[action]) {
              const handler = editorActionMap[action];
              tiptapShortcuts[pmKey] = () => handler(editorRef);
            } else if (domEventActions.has(action)) {
              tiptapShortcuts[pmKey] = () => {
                window.dispatchEvent(
                  new CustomEvent("keybinding-action", { detail: { action } })
                );
                return true;
              };
            }
          }

          return tiptapShortcuts;
        },
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-base max-w-none focus:outline-none min-h-[500px] p-6",
        spellcheck: spellcheckEnabled ? "true" : "false",
      },
      // Auto-close brackets/quotes: when user types an opening bracket,
      // insert the closing pair and position cursor between them.
      // Only applies in regular text (not code blocks). Toggle via localStorage.
      handleKeyDown(view, event) {
        // Check if auto-close is enabled (default: on)
        let autoCloseEnabled = true;
        try {
          const stored = localStorage.getItem("autoCloseBrackets");
          if (stored === "false") autoCloseEnabled = false;
        } catch {}
        if (!autoCloseEnabled) return false;

        const pairs: Record<string, string> = {
          "(": ")",
          "[": "]",
          "{": "}",
          '"': '"',
          "`": "`",
        };

        const closing = pairs[event.key];
        if (!closing) return false;

        // Don't apply inside code blocks
        const { $from } = view.state.selection;
        const parentName = $from.parent.type.name;
        if (parentName === "codeBlock") return false;

        // For quotes/backticks, don't auto-close if the character before cursor
        // is a word character (likely mid-word apostrophe or similar)
        if (event.key === '"' || event.key === "`") {
          const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
          if (textBefore && /\w$/.test(textBefore)) return false;
        }

        event.preventDefault();
        const { tr } = view.state;
        const { from, to } = view.state.selection;
        if (from !== to) {
          // Wrap selection with pair
          const selectedText = view.state.doc.textBetween(from, to);
          tr.replaceWith(from, to, view.state.schema.text(event.key + selectedText + closing));
          tr.setSelection(
            // @ts-expect-error - TextSelection import
            view.state.selection.constructor.create(tr.doc, from + 1, from + 1 + selectedText.length)
          );
        } else {
          tr.insertText(event.key + closing, from);
          tr.setSelection(
            // @ts-expect-error - TextSelection import
            view.state.selection.constructor.create(tr.doc, from + 1)
          );
        }
        view.dispatch(tr);
        return true;
      },
      // Convert plain-text markdown-style lists when pasted so that
      // "- item1\n- item2\n- item3" becomes a proper <ul> list.
      // transformPastedHTML receives the HTML string that ProseMirror will parse.
      // When only plain text is on the clipboard, Tiptap generates HTML wrapping
      // each line in <p> tags like: <p>- item1</p><p>- item2</p>
      // We intercept and rebuild as a proper <ul>.
      handlePaste(view, event) {
        // Paste as plain text when Shift is held (Cmd+Shift+V)
        if ((event as unknown as KeyboardEvent).shiftKey) {
          const plainText = event.clipboardData?.getData("text/plain");
          if (plainText) {
            event.preventDefault();
            const { schema, tr } = view.state;
            const textNode = schema.text(plainText);
            view.dispatch(tr.replaceSelectionWith(textNode, true));
            return true;
          }
        }

        // Handle image paste
        const pasteItems = event.clipboardData?.items;
        if (pasteItems) {
          for (const item of Array.from(pasteItems)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;

              uploadImage(file).then((url) => {
                if (url) {
                  const { schema } = view.state;
                  const imageNode = schema.nodes.image;
                  if (imageNode) {
                    const node = imageNode.create({ src: url });
                    const tr = view.state.tr.replaceSelectionWith(node);
                    view.dispatch(tr);
                  }
                }
              });
              return true;
            }
          }
        }

        // Handle YouTube/Loom URL paste → embed block
        const pastedText = event.clipboardData?.getData('text/plain') || '';
        if (pastedText.trim() && !pastedText.includes('\n')) {
          const embedResult = parseEmbedUrl(pastedText);
          if (embedResult) {
            event.preventDefault();
            const { schema } = view.state;
            const embedNode = schema.nodes.embedBlock;
            if (embedNode) {
              const node = embedNode.create({
                src: embedResult.embedUrl,
                provider: embedResult.provider,
              });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            }
            return true;
          }
        }

        // Smart Paste: TSV (tab-separated values) → table
        const smartText = event.clipboardData?.getData('text/plain') || '';
        const smartLines = smartText.split('\n').filter(l => l.trim() !== '');
        if (smartLines.length >= 2 && smartLines.every(l => l.includes('\t'))) {
          event.preventDefault();
          const rows = smartLines.map(l => l.split('\t'));
          const colCount = Math.max(...rows.map(r => r.length));
          const tableRows = rows.map((cells, rowIdx) => {
            const cellType = rowIdx === 0 ? 'tableHeader' : 'tableCell';
            const tableCells = [];
            for (let c = 0; c < colCount; c++) {
              tableCells.push({
                type: cellType,
                content: [{ type: 'paragraph', content: cells[c] ? [{ type: 'text', text: cells[c] }] : [] }],
              });
            }
            return { type: 'tableRow', content: tableCells };
          });
          const { schema } = view.state;
          if (schema.nodes.table) {
            const edRef = (view as unknown as { editor?: TiptapEditor }).editor;
            if (edRef) {
              edRef.chain().focus().insertContent({ type: 'table', content: tableRows }).run();
            } else {
              // Fallback: direct ProseMirror insertion
              try {
                const tableNode = schema.nodeFromJSON({ type: 'table', content: tableRows });
                view.dispatch(view.state.tr.replaceSelectionWith(tableNode));
              } catch { /* ignore */ }
            }
          }
          return true;
        }

        // Smart Paste: code detection → code block
        if (smartLines.length >= 2) {
          const codePatterns = /^(function |const |let |var |import |export |def |class |#include|package |from |public |private |protected |if \(|for \(|while \(|\/\/ |\/\*|#!)/;
          const firstNonEmpty = smartLines.find(l => l.trim().length > 0) || '';
          const hasIndentation = smartLines.filter(l => l.trim().length > 0).some(l => /^\s{2,}/.test(l));
          if (codePatterns.test(firstNonEmpty.trim()) && hasIndentation) {
            event.preventDefault();
            let language = '';
            if (/^(import |from |def )/.test(firstNonEmpty.trim())) language = 'python';
            else if (/^(function |const |let |var |export |import )/.test(firstNonEmpty.trim())) language = 'javascript';
            else if (/^#include/.test(firstNonEmpty.trim())) language = 'c';
            else if (/^package /.test(firstNonEmpty.trim())) language = 'go';
            else if (/^(public |private |protected )/.test(firstNonEmpty.trim())) language = 'java';

            const { schema } = view.state;
            const codeBlockType = schema.nodes.codeBlock;
            if (codeBlockType) {
              const node = codeBlockType.create({ language }, schema.text(smartText));
              view.dispatch(view.state.tr.replaceSelectionWith(node));
            }
            return true;
          }
        }

        // Handle plain-text markdown-style list paste (existing logic)
        const text = event.clipboardData?.getData('text/plain') || '';
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const allBullets = lines.length > 0 && lines.every(l => /^[-*]\s/.test(l));
        if (allBullets) {
          const items = lines.map(l => l.replace(/^[-*]\s/, '').trim());
          const { schema } = view.state;
          const bulletListType = schema.nodes.bulletList;
          const listItemType = schema.nodes.listItem;
          const paragraphType = schema.nodes.paragraph;
          if (bulletListType && listItemType && paragraphType) {
            const listItems = items.map(item =>
              listItemType.create(null, paragraphType.create(null, item ? schema.text(item) : []))
            );
            const bulletList = bulletListType.create(null, listItems);
            const { tr } = view.state;
            const insertTr = tr.replaceSelectionWith(bulletList);
            view.dispatch(insertTr);
            return true;
          }
        }
        return false;
      },
      transformPastedHTML(html: string, _view?: unknown): string {
        // Check if the pasted HTML consists entirely of paragraphs that look like
        // markdown list items (e.g. produced by plain-text paste conversion).
        const bulletParagraphRegex = /^(<p>\s*[-+*]\s[^<]*<\/p>\s*)+$/;
        if (!bulletParagraphRegex.test(html.trim())) return html;

        // Extract paragraph content and build a <ul>
        const itemRegex = /<p>\s*[-+*]\s([\s\S]*?)<\/p>/g;
        let result = "<ul>";
        let match: RegExpExecArray | null;
        while ((match = itemRegex.exec(html)) !== null) {
          result += `<li><p>${match[1]}</p></li>`;
        }
        result += "</ul>";
        return result;
      },
    },
    immediatelyRender: false,
    onUpdate({ editor: ed }) {
      // Word count
      const text = ed.state.doc.textContent;
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount({ words, chars: text.length });

      // Document size
      const bytes = new Blob([ed.getHTML()]).size;
      if (bytes < 1024) setDocSize(`${bytes} B`);
      else if (bytes < 1024 * 1024) setDocSize(`${(bytes / 1024).toFixed(1)} KB`);
      else setDocSize(`${(bytes / (1024 * 1024)).toFixed(1)} MB`);

      const { state, view } = ed;
      const { $from } = state.selection;

      // Only trigger in paragraph nodes (not code blocks, headings, etc.)
      if ($from.parent.type.name !== "paragraph") {
        setSlashMenu(null);
        return;
      }

      // Get text in the current block up to the cursor
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");

      // Match a leading "/" optionally followed by word characters
      const match = textBefore.match(/^\/(\w*)$/);
      if (match) {
        const coords = view.coordsAtPos($from.pos);
        const editorEl = view.dom.closest(".flex-1") as HTMLElement | null;
        const scrollTop = editorEl?.scrollTop ?? 0;
        setSlashMenu({
          query: match[1],
          pos: {
            top: coords.bottom - scrollTop,
            left: coords.left,
          },
        });
      } else {
        setSlashMenu(null);
      }
    },
    onSelectionUpdate({ editor: ed }) {
      // Track if there's a text selection for "Expand with AI" button
      const { from, to } = ed.state.selection;
      setHasTextSelection(from !== to);

      // Close menu if cursor moves away from a slash position
      const { state } = ed;
      const { $from } = state.selection;
      if ($from.parent.type.name !== "paragraph") {
        setSlashMenu(null);
        return;
      }
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
      if (!textBefore.match(/^\/\w*$/)) {
        setSlashMenu(null);
      }
    },
    onTransaction() {
      // Force re-render so SearchBar picks up latest match count/index
      // from the ProseMirror plugin state. The useEditor hook already
      // triggers re-renders on transactions, so this is a no-op callback
      // ensuring the hook is aware we depend on transaction updates.
    },
  });

  // Typewriter mode: keep cursor at 40% viewport height
  useEffect(() => {
    if (!editor || !typewriterMode) return;

    const handleSelectionUpdate = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      try {
        const { view } = editor;
        const { head } = view.state.selection;
        const coords = view.coordsAtPos(head);
        const containerRect = container.getBoundingClientRect();
        const cursorTop = coords.top - containerRect.top + container.scrollTop;
        const targetOffset = container.clientHeight * 0.4;
        const scrollTarget = cursorTop - targetOffset;

        container.scrollTo({
          top: Math.max(0, scrollTarget),
          behavior: "smooth",
        });
      } catch {
        // Ignore errors from invalid positions
      }
    };

    editor.on("selectionUpdate", handleSelectionUpdate);
    return () => {
      editor.off("selectionUpdate", handleSelectionUpdate);
    };
  }, [editor, typewriterMode]);

  // Auto-save draft to localStorage (debounced)
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = setTimeout(() => {
        try {
          const html = editor.getHTML();
          localStorage.setItem(draftKey, html);
        } catch {
          // Storage full or unavailable
        }
      }, 2000);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current);
    };
  }, [editor, draftKey]);

  // Check for unsaved draft on load
  useEffect(() => {
    if (!editor) return;
    const timer = setTimeout(() => {
      try {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) {
          const currentHtml = editor.getHTML();
          if (savedDraft !== currentHtml && savedDraft.length > 20) {
            setShowDraftBanner(true);
          }
        }
      } catch {
        // ignore
      }
    }, 1500); // Wait for Yjs sync first
    return () => clearTimeout(timer);
  }, [editor, draftKey]);

  // Clear draft on successful Yjs sync
  useEffect(() => {
    const onSync = (isSynced: boolean) => {
      if (isSynced) {
        // Don't clear immediately — give a short delay for the editor to update
        setTimeout(() => {
          // Only clear if the banner is not showing (user hasn't been prompted yet)
          if (!showDraftBanner) {
            // Keep the draft — don't clear here so recovery is possible
          }
        }, 500);
      }
    };
    provider.on("sync", onSync);
    return () => provider.off("sync", onSync);
  }, [provider, draftKey, showDraftBanner]);

  const handleRecoverDraft = useCallback(() => {
    if (!editor) return;
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        editor.commands.setContent(savedDraft);
      }
    } catch {
      // ignore
    }
    setShowDraftBanner(false);
    localStorage.removeItem(draftKey);
  }, [editor, draftKey]);

  const handleDismissDraft = useCallback(() => {
    setShowDraftBanner(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Init heading anchor smooth scrolling
  useEffect(() => {
    initAnchorScrolling();
  }, []);

  // Handle clicks on heading anchor pseudo-elements to copy link
  useEffect(() => {
    if (!editor) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("heading-anchor-target")) {
        // Check if click is in the left margin area (pseudo-element region)
        const rect = target.getBoundingClientRect();
        if (e.clientX < rect.left) {
          const slug = target.getAttribute("data-slug");
          if (slug) {
            const url = `${window.location.origin}${window.location.pathname}#${slug}`;
            navigator.clipboard.writeText(url).catch(() => {});
          }
        }
      }
    };
    const editorEl = editor.view.dom;
    editorEl.addEventListener("click", handleClick);
    return () => editorEl.removeEventListener("click", handleClick);
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(effectiveEditable);
    }
  }, [editor, effectiveEditable]);

  useEffect(() => {
    if (!editor || mode === undefined) return;
    setSuggestModeEnabled(
      editor as unknown as { view: { state: unknown; dispatch: (tr: unknown) => void } },
      mode === "suggest",
    );
  }, [editor, mode]);

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Inject template content into empty document
  useEffect(() => {
    if (!editor || !initialContent || templateApplied) return;
    // Wait for Yjs to sync before checking emptiness
    const timer = setTimeout(() => {
      const text = editor.state.doc.textContent.trim();
      if (!text) {
        editor.commands.setContent(initialContent);
      }
      setTemplateApplied(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [editor, initialContent, templateApplied]);

  // Keyboard shortcuts for find/replace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setShowReplace(false);
      } else if (mod && e.key === "h") {
        e.preventDefault();
        setSearchOpen(true);
        setShowReplace(true);
      } else if (mod && e.key === "k") {
        e.preventDefault();
        setLinkDialogOpen(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Register Cmd+/ (Ctrl+/ on non-Mac) to toggle shortcuts help
  useEffect(() => {
    if (!onToggleShortcutsHelp) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        onToggleShortcutsHelp();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onToggleShortcutsHelp]);

  // Handle custom keybinding actions dispatched from the ProseMirror keymap plugin.
  // This bridges remapped shortcuts (e.g. find, link, shortcuts-help) into React state.
  useEffect(() => {
    const handleAction = (e: Event) => {
      const action = (e as CustomEvent).detail?.action;
      if (!action) return;
      switch (action) {
        case "find":
          setSearchOpen(true);
          setShowReplace(false);
          break;
        case "find-replace":
          setSearchOpen(true);
          setShowReplace(true);
          break;
        case "link":
          setLinkDialogOpen(true);
          break;
        case "shortcuts-help":
          onToggleShortcutsHelp?.();
          break;
        case "command-palette":
          // Dispatched to any command palette listener in the app
          window.dispatchEvent(new CustomEvent("open-command-palette"));
          break;
      }
    };
    window.addEventListener("keybinding-action", handleAction);
    return () => window.removeEventListener("keybinding-action", handleAction);
  }, [onToggleShortcutsHelp]);

  // Drive the decoration plugin from React state — survives Tiptap view updates
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(commentDecorationKey, activeCommentId ?? null)
    );
  }, [editor, activeCommentId]);

  const searchState = editor
    ? searchReplacePluginKey.getState(editor.state)
    : null;

  const handleQueryChange = (query: string) => {
    setSearchQuery(query);
    editor?.commands.setSearchQuery(query);
  };

  const handleClose = () => {
    setSearchOpen(false);
    setSearchQuery("");
    editor?.commands.clearSearch();
    editor?.commands.focus();
  };

  return (
    <div ref={scrollContainerRef} className={`flex-1 overflow-auto bg-[#ffffff] relative ${typewriterMode ? "typewriter-mode" : ""}`}>
      {isScrollable && (
        <div
          className="reading-progress-bar"
          style={{ width: `${scrollProgress}%` }}
          role="progressbar"
          aria-valuenow={Math.round(scrollProgress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Reading progress"
        />
      )}
      {searchOpen && editor && (
        <SearchBar
          query={searchQuery}
          matchCount={searchState?.matches.length ?? 0}
          currentIndex={searchState?.currentIndex ?? 0}
          caseSensitive={searchState?.caseSensitive ?? false}
          showReplace={showReplace}
          onQueryChange={handleQueryChange}
          onFindNext={() => editor.commands.findNext()}
          onFindPrevious={() => editor.commands.findPrevious()}
          onReplace={(replacement) => editor.commands.replaceCurrent(replacement)}
          onReplaceAll={(replacement) => editor.commands.replaceAll(replacement)}
          onToggleCaseSensitive={() => editor.commands.toggleCaseSensitive()}
          onToggleReplace={() => setShowReplace((v) => !v)}
          onClose={handleClose}
        />
      )}
      {linkDialogOpen && editor && (
        <LinkDialog
          editor={editor}
          onClose={() => setLinkDialogOpen(false)}
        />
      )}
      {/* BubbleMenu removed: @tiptap/react v3 doesn't export BubbleMenu React component.
          Formatting is available via the static toolbar above. */}
      {showDraftBanner && (
        <div className="mx-6 mt-2 mb-1 flex items-center gap-3 rounded-lg border border-[rgba(221,91,0,0.5)] bg-[#fbece0] px-4 py-2.5">
          <svg className="h-4 w-4 text-[#dd5b00] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-[#dd5b00] flex-1">Unsaved draft found. Recover changes?</span>
          <button
            onClick={handleRecoverDraft}
            className="px-2.5 py-1 rounded text-xs font-medium text-white bg-[#dd5b00] hover:bg-[#b14800] transition-colors"
          >
            Recover
          </button>
          <button
            onClick={handleDismissDraft}
            className="px-2.5 py-1 rounded text-xs font-medium text-[#dd5b00] hover:text-[#31302e] hover:bg-[#fbece0] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      {editor && <TableAddButtons editor={editor} />}
      {editor && <AIAutoComplete editor={editor} enabled={autoCompleteEnabled} />}
      <EditorStatusBar
        editor={editor}
        documentId={documentId}
        ydoc={ydoc}
        saveStatus={saveStatus}
        lastSyncTime={lastSyncTime}
        now={now}
        lastSavedByName={lastSavedByName}
        hasTextSelection={hasTextSelection}
        wordCount={wordCount}
        docSize={docSize}
        spellcheckEnabled={spellcheckEnabled}
        onSpellcheckChange={setSpellcheckEnabled}
        typewriterMode={typewriterMode}
        onTypewriterChange={setTypewriterMode}
        wordGoal={wordGoal}
        onWordGoalChange={setWordGoal}
      />
      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => {
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-20 right-6 z-40 hidden md:flex items-center justify-center w-9 h-9 rounded-full bg-[#ffffff] text-[#31302e] border border-[rgba(0,0,0,0.1)] shadow-md hover:bg-[#f6f5f4] transition-all opacity-80 hover:opacity-100"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      )}
      {slashMenu && editor && (
        <SlashCommandMenu
          editor={editor}
          query={slashMenu.query}
          position={slashMenu.pos}
          onClose={() => setSlashMenu(null)}
        />
      )}
      {editor && <TableSortMenu editor={editor} />}
    </div>
  );
}

/**
 * Floating + buttons on table edges for adding rows/columns.
 * Visible when cursor is in a table.
 */
function TableAddButtons({ editor }: { editor: TiptapEditor }) {
  const [tableRect, setTableRect] = useState<DOMRect | null>(null);
  const [isInTable, setIsInTable] = useState(false);

  useEffect(() => {
    const update = () => {
      const { $from } = editor.state.selection;
      // Walk up to find if we're inside a table
      let inTable = false;
      for (let d = $from.depth; d >= 0; d--) {
        if ($from.node(d).type.name === "table") {
          inTable = true;
          break;
        }
      }
      setIsInTable(inTable);

      if (inTable) {
        // Find the table DOM element
        const tableEl = editor.view.dom.querySelector("table.editor-table");
        if (tableEl) {
          const container = tableEl.closest(".flex-1.overflow-auto");
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const tRect = tableEl.getBoundingClientRect();
            setTableRect(new DOMRect(
              tRect.left - containerRect.left + container.scrollLeft,
              tRect.top - containerRect.top + container.scrollTop,
              tRect.width,
              tRect.height
            ));
          } else {
            setTableRect(tableEl.getBoundingClientRect());
          }
        }
      }
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("update", update);
    };
  }, [editor]);

  if (!isInTable || !tableRect) return null;

  return (
    <div className="table-add-buttons" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {/* Add column button — right edge */}
      <button
        className="table-add-btn visible"
        style={{
          top: tableRect.top + tableRect.height / 2 - 10,
          left: tableRect.left + tableRect.width + 6,
          pointerEvents: "auto",
        }}
        title="Add column"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        +
      </button>
      {/* Add row button — bottom edge */}
      <button
        className="table-add-btn visible"
        style={{
          top: tableRect.top + tableRect.height + 6,
          left: tableRect.left + tableRect.width / 2 - 10,
          pointerEvents: "auto",
        }}
        title="Add row"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        +
      </button>
    </div>
  );
}

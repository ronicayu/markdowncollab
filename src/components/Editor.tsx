"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { RemoteCursors } from "@/extensions/remote-cursors";
import { getUserColor } from "@/lib/cursor-utils";
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark, commentDecorationKey } from "@/extensions/comment-mark";
import { Markdown } from "tiptap-markdown";
import Image from "@tiptap/extension-image";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
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
import { PersonalHighlight } from "@/extensions/personal-highlight";
import { calculateHealthScore, type HealthScore as HealthScoreType } from "@/lib/health-score";
import AIAutoComplete from "./AIAutoComplete";
import FocusTimer from "./FocusTimer";
import CursorChat from "./CursorChat";
import SessionHistory from "./SessionHistory";
import { GrammarCheck, grammarCheckPluginKey } from "@/extensions/grammar-check";
import { ProgressBlock } from "@/extensions/progress-block";
import { SectionLockExtension } from "@/extensions/section-lock";
import { BreadcrumbBlock } from "@/extensions/breadcrumb-block";
import { IssueLinker } from "@/extensions/issue-linker";
import WordFrequencyTable from "./WordFrequencyTable";
import { Extension } from "@tiptap/core";
import { createHeatmapPlugin, heatmapPluginKey } from "@/extensions/heatmap-plugin";
import { HeadingAnchor, initAnchorScrolling } from "@/extensions/heading-anchor";
import { InlineDate } from "@/extensions/inline-date";


interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  onEditorReady?: (editor: TiptapEditor) => void;
  activeCommentId?: string | null;
  editable?: boolean;
  initialContent?: string | null;
  onToggleShortcutsHelp?: () => void;
  templateId?: string;
  autoCompleteEnabled?: boolean;
  grammarCheckEnabled?: boolean;
}

export default function Editor({
  documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  editable = true,
  initialContent,
  onToggleShortcutsHelp,
  templateId,
  autoCompleteEnabled = false,
  grammarCheckEnabled = false,
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
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [healthScore, setHealthScore] = useState<HealthScoreType | null>(null);
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [lastSavedByName, setLastSavedByName] = useState<string | null>(null);
  const [typewriterMode, setTypewriterMode] = useState(false);
  const [showWordFrequency, setShowWordFrequency] = useState(false);
  const [hasTextSelection, setHasTextSelection] = useState(false);
  const [expandLoading, setExpandLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteMenuOpen, setRewriteMenuOpen] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<{ text: string; from: number; to: number } | null>(null);
  const [summarizeLoading, setSummarizeLoading] = useState(false);
  const [summaryPopover, setSummaryPopover] = useState<{ text: string; from: number; to: number } | null>(null);
  const [docSize, setDocSize] = useState("");
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = localStorage.getItem("spellcheckEnabled");
      return stored === null ? true : stored === "true";
    } catch { return true; }
  });
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [showDraftBanner, setShowDraftBanner] = useState(false);
  const draftKey = `draft:${documentId}`;
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [issueSettingsOpen, setIssueSettingsOpen] = useState(false);
  const [issuePatterns, setIssuePatterns] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const stored = localStorage.getItem("issueLinker:patterns");
      return stored || '{\n  "JIRA": "https://jira.example.com/browse/{ref}",\n  "GH": "https://github.com/org/repo/issues/{num}",\n  "#": "https://github.com/org/repo/issues/{num}"\n}';
    } catch { return ""; }
  });

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

  const editor = useEditor({
    editable,
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
      Highlight.configure({
        multicolor: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
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
      PersonalHighlight.configure({
        documentId,
      }),
      GrammarCheck,
      ProgressBlock,
      BreadcrumbBlock,
      SectionLockExtension.configure({
        ydoc,
        currentUser: userName,
      }),
      IssueLinker,
      HeadingAnchor,
      InlineDate,
      Extension.create({
        name: "heatmap",
        addProseMirrorPlugins() {
          return [createHeatmapPlugin()];
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
        if (event.shiftKey) {
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

      // Health score (use markdown storage for accurate markdown syntax detection)
      try {
        const mdText = (ed.storage as any).markdown?.getMarkdown?.() ?? text;
        setHealthScore(calculateHealthScore(mdText, templateId));
      } catch {
        setHealthScore(calculateHealthScore(text, templateId));
      }

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

  // Toggle heatmap
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(heatmapPluginKey, { enabled: heatmapEnabled })
    );
  }, [editor, heatmapEnabled]);

  // Toggle grammar check
  useEffect(() => {
    if (!editor) return;
    editor.storage.grammarCheck.enabled = grammarCheckEnabled;
    if (!grammarCheckEnabled) {
      // Clear decorations when disabled
      editor.view.dispatch(
        editor.view.state.tr.setMeta(grammarCheckPluginKey, { clear: true })
      );
    }
  }, [editor, grammarCheckEnabled]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

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
    <div ref={scrollContainerRef} className={`flex-1 overflow-auto bg-[#FFFEF9] relative ${typewriterMode ? "typewriter-mode" : ""}`}>
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
        <div className="mx-6 mt-2 mb-1 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
          <svg className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <span className="text-xs text-amber-800 flex-1">Unsaved draft found. Recover changes?</span>
          <button
            onClick={handleRecoverDraft}
            className="px-2.5 py-1 rounded text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors"
          >
            Recover
          </button>
          <button
            onClick={handleDismissDraft}
            className="px-2.5 py-1 rounded text-xs font-medium text-amber-700 hover:text-amber-900 hover:bg-amber-100 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      {editor && <AIAutoComplete editor={editor} enabled={autoCompleteEnabled} />}
      <div className="sticky bottom-0 flex justify-between items-center px-4 py-1.5 text-xs text-gray-400 bg-[#FFFEF9]/80 backdrop-blur-sm border-t border-gray-100">
        <span>
          {saveStatus === "saving" ? (
            "Saving..."
          ) : lastSyncTime ? (
            (() => {
              const ago = Math.floor((now - lastSyncTime) / 1000);
              const byLine = lastSavedByName ? ` by ${lastSavedByName}` : "";
              if (ago < 10) return `Saved${byLine} just now`;
              if (ago < 60) return `Saved${byLine} ${ago}s ago`;
              if (ago < 3600) return `Saved${byLine} ${Math.floor(ago / 60)}m ago`;
              return `Saved${byLine} ${new Date(lastSyncTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
            })()
          ) : ""}
        </span>
        {/* Expand with AI — shown when text is selected */}
        {hasTextSelection && editor && (
          <button
            onClick={async () => {
              if (!editor || expandLoading) return;
              const { from, to } = editor.state.selection;
              const selectedText = editor.state.doc.textBetween(from, to, " ");
              if (!selectedText.trim()) return;
              setExpandLoading(true);
              try {
                const res = await fetch("/api/agent/expand", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: selectedText }),
                });
                if (res.ok) {
                  const { expanded } = await res.json();
                  if (expanded) {
                    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, expanded).run();
                  }
                }
              } catch (err) {
                console.error("Expand failed:", err);
              } finally {
                setExpandLoading(false);
              }
            }}
            disabled={expandLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 transition-colors"
            title="Expand selected text with AI"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            {expandLoading ? "Expanding..." : "Expand with AI"}
          </button>
        )}
        {/* Summarize with AI — shown when text is selected */}
        {hasTextSelection && editor && (
          <div className="relative">
            <button
              onClick={async () => {
                if (!editor || summarizeLoading) return;
                const { from, to } = editor.state.selection;
                const selectedText = editor.state.doc.textBetween(from, to, " ");
                if (!selectedText.trim()) return;
                setSummarizeLoading(true);
                try {
                  const res = await fetch("/api/agent/summarize-selection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: selectedText }),
                  });
                  if (res.ok) {
                    const { summary } = await res.json();
                    if (summary) {
                      setSummaryPopover({ text: summary, from, to });
                    }
                  }
                } catch (err) {
                  console.error("Summarize failed:", err);
                } finally {
                  setSummarizeLoading(false);
                }
              }}
              disabled={summarizeLoading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 disabled:opacity-50 transition-colors"
              title="Summarize selected text with AI"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M12 17.25h8.25" />
              </svg>
              {summarizeLoading ? "Summarizing..." : "Summarize"}
            </button>
            {summaryPopover && (
              <div className="absolute bottom-7 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 w-72">
                <p className="text-xs text-gray-700 mb-2">{summaryPopover.text}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      editor.chain().focus().deleteRange({ from: summaryPopover.from, to: summaryPopover.to }).insertContentAt(summaryPopover.from, summaryPopover.text).run();
                      setSummaryPopover(null);
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-green-700 bg-green-50 hover:bg-green-100"
                  >
                    Replace
                  </button>
                  <button
                    onClick={() => {
                      editor.chain().focus().insertContentAt(summaryPopover.to, "\n\n" + summaryPopover.text).run();
                      setSummaryPopover(null);
                    }}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                  >
                    Insert below
                  </button>
                  <button
                    onClick={() => setSummaryPopover(null)}
                    className="px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 bg-gray-50 hover:bg-gray-100"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Rewrite with AI — shown when text is selected */}
        {hasTextSelection && editor && (
          <div className="relative">
            <button
              onClick={() => setRewriteMenuOpen((v) => !v)}
              disabled={rewriteLoading}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
              title="Rewrite selected text with AI"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              {rewriteLoading ? "Rewriting..." : "Rewrite"}
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {rewriteMenuOpen && (
              <div className="absolute bottom-7 left-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 w-36">
                {[
                  { style: "shorter", label: "Make shorter" },
                  { style: "longer", label: "Make longer" },
                  { style: "simpler", label: "Simplify" },
                  { style: "formal", label: "Make formal" },
                ].map(({ style, label }) => (
                  <button
                    key={style}
                    onClick={async () => {
                      setRewriteMenuOpen(false);
                      if (!editor || rewriteLoading) return;
                      const { from, to } = editor.state.selection;
                      const selectedText = editor.state.doc.textBetween(from, to, " ");
                      if (!selectedText.trim()) return;
                      setRewriteLoading(true);
                      try {
                        const res = await fetch("/api/agent/rewrite", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text: selectedText, style }),
                        });
                        if (res.ok) {
                          const { rewritten } = await res.json();
                          if (rewritten) {
                            setRewritePreview({ text: rewritten, from, to });
                          }
                        }
                      } catch (err) {
                        console.error("Rewrite failed:", err);
                      } finally {
                        setRewriteLoading(false);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Rewrite preview accept/reject */}
        {rewritePreview && editor && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-indigo-600 max-w-[200px] truncate" title={rewritePreview.text}>
              Preview: {rewritePreview.text.slice(0, 40)}...
            </span>
            <button
              onClick={() => {
                editor.chain().focus().deleteRange({ from: rewritePreview.from, to: rewritePreview.to }).insertContentAt(rewritePreview.from, rewritePreview.text).run();
                setRewritePreview(null);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-green-700 bg-green-50 hover:bg-green-100"
            >
              Accept
            </button>
            <button
              onClick={() => setRewritePreview(null)}
              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-red-700 bg-red-50 hover:bg-red-100"
            >
              Reject
            </button>
          </div>
        )}
        {/* Cursor Chat */}
        <CursorChat provider={provider} userName={userName} />
        {/* Session History */}
        <SessionHistory editor={editor} />
        {/* Spellcheck Toggle */}
        <button
          onClick={() => {
            const next = !spellcheckEnabled;
            setSpellcheckEnabled(next);
            try { localStorage.setItem("spellcheckEnabled", String(next)); } catch {}
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
            spellcheckEnabled
              ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          title={spellcheckEnabled ? "Disable spellcheck" : "Enable spellcheck"}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Spellcheck
        </button>
        {/* Heatmap Toggle */}
        <button
          onClick={() => setHeatmapEnabled((v) => !v)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
            heatmapEnabled
              ? "text-orange-600 bg-orange-50 hover:bg-orange-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          title={heatmapEnabled ? "Hide edit heatmap" : "Show edit heatmap"}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
          </svg>
          Heatmap
        </button>
        {/* Typewriter Mode Toggle */}
        <button
          onClick={() => {
            const next = !typewriterMode;
            setTypewriterMode(next);
            try { localStorage.setItem(`typewriterMode:${documentId}`, String(next)); } catch {}
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors ${
            typewriterMode
              ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          }`}
          title={typewriterMode ? "Disable typewriter mode" : "Enable typewriter mode"}
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Typewriter
        </button>
        {/* Issue Tracker Settings */}
        <button
          onClick={() => setIssueSettingsOpen(true)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          title="Issue tracker link settings"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
          Issues
        </button>
        {/* Focus Timer */}
        <FocusTimer documentId={documentId} />
        {/* Health Score Badge */}
        {healthScore && (
          <div className="relative">
            <button
              onClick={() => setShowHealthDetails((v) => !v)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                healthScore.color === "green"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : healthScore.color === "amber"
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                  : "bg-red-100 text-red-700 hover:bg-red-200"
              }`}
              title="Document Health Score — click for details"
            >
              <span>{healthScore.score}</span>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
            {showHealthDetails && (
              <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 text-xs text-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">Health Score: {healthScore.score}/100</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowHealthDetails(false); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span>Readability (Flesch)</span>
                    <span className="font-medium">{healthScore.metrics.fleschReadingEase}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg sentence length</span>
                    <span className="font-medium">{healthScore.metrics.avgSentenceLength} words</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Has headings</span>
                    <span className="font-medium">{healthScore.metrics.hasHeadings ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Has links</span>
                    <span className="font-medium">{healthScore.metrics.hasLinks ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Word count</span>
                    <span className="font-medium">{healthScore.metrics.wordCount} {healthScore.metrics.wordCountAppropriate ? "" : "(too short)"}</span>
                  </div>
                  {healthScore.metrics.templateCompleteness !== null && (
                    <div className="flex justify-between">
                      <span>Template completeness</span>
                      <span className="font-medium">{healthScore.metrics.templateCompleteness}%</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowWordFrequency((v) => !v); }}
                  className="mt-2 w-full text-left text-[10px] font-medium text-[#B8692A] hover:text-[#96541F] transition-colors"
                >
                  {showWordFrequency ? "Hide word frequency" : "Show word frequency"}
                </button>
                {showWordFrequency && editor && (
                  <div className="mt-2 max-h-60 overflow-y-auto border-t border-gray-100 pt-2">
                    <WordFrequencyTable text={editor.state.doc.textContent} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <span
          className="cursor-pointer hover:text-gray-600 transition-colors relative"
          onClick={() => {
            setGoalInputValue(wordGoal ? String(wordGoal) : "");
            setShowGoalInput(true);
          }}
          title="Click to set a word count goal"
        >
          {wordGoal ? (
            <span className="flex items-center gap-2">
              <span>{wordCount.words} / {wordGoal} words</span>
              <span className="inline-flex items-center w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <span
                  className={`h-full rounded-full transition-all ${
                    wordCount.words >= wordGoal
                      ? "bg-green-500"
                      : wordCount.words >= wordGoal * 0.5
                      ? "bg-amber-400"
                      : "bg-gray-400"
                  }`}
                  style={{ width: `${Math.min(100, (wordCount.words / wordGoal) * 100)}%` }}
                />
              </span>
              <span className={`text-[10px] ${
                wordCount.words >= wordGoal
                  ? "text-green-600"
                  : wordCount.words >= wordGoal * 0.5
                  ? "text-amber-500"
                  : "text-gray-400"
              }`}>
                {Math.min(100, Math.round((wordCount.words / wordGoal) * 100))}%
              </span>
            </span>
          ) : (
            <span>{wordCount.words} words · {wordCount.chars} characters · {wordCount.words < 200 ? "< 1" : Math.ceil(wordCount.words / 200)} min read{docSize ? ` · ${docSize}` : ""}</span>
          )}
        </span>
        {showGoalInput && (
          <div className="absolute bottom-8 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50">
            <p className="text-xs font-medium text-gray-700 mb-2">Set word count goal</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                placeholder="e.g. 500"
                value={goalInputValue}
                onChange={(e) => setGoalInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseInt(goalInputValue, 10);
                    if (val > 0) {
                      setWordGoal(val);
                      localStorage.setItem(`wordGoal:${documentId}`, String(val));
                    } else {
                      setWordGoal(null);
                      localStorage.removeItem(`wordGoal:${documentId}`);
                    }
                    setShowGoalInput(false);
                  } else if (e.key === "Escape") {
                    setShowGoalInput(false);
                  }
                }}
                className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-400"
                autoFocus
              />
              <button
                onClick={() => {
                  const val = parseInt(goalInputValue, 10);
                  if (val > 0) {
                    setWordGoal(val);
                    localStorage.setItem(`wordGoal:${documentId}`, String(val));
                  } else {
                    setWordGoal(null);
                    localStorage.removeItem(`wordGoal:${documentId}`);
                  }
                  setShowGoalInput(false);
                }}
                className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                Set
              </button>
              {wordGoal && (
                <button
                  onClick={() => {
                    setWordGoal(null);
                    localStorage.removeItem(`wordGoal:${documentId}`);
                    setShowGoalInput(false);
                  }}
                  className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          onClick={() => {
            scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-20 right-6 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-[#111110] text-white shadow-lg hover:bg-[#333] transition-all opacity-80 hover:opacity-100"
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
      {/* Issue Tracker Settings Dialog */}
      {issueSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setIssueSettingsOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Issue Tracker Settings</h3>
            <p className="text-xs text-gray-500 mb-3">
              Configure URL patterns for auto-linking. Use {"{ref}"} for the full reference (e.g. JIRA-123) and {"{num}"} for just the number.
            </p>
            <textarea
              value={issuePatterns}
              onChange={(e) => setIssuePatterns(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 font-mono resize-none focus:outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
              rows={6}
              placeholder='{"JIRA": "https://jira.example.com/browse/{ref}"}'
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => {
                  try {
                    JSON.parse(issuePatterns);
                    localStorage.setItem("issueLinker:patterns", issuePatterns);
                    setIssueSettingsOpen(false);
                  } catch {
                    alert("Invalid JSON. Please check the format.");
                  }
                }}
                className="text-sm font-medium bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg transition-colors"
              >
                Save
              </button>
              <button onClick={() => setIssueSettingsOpen(false)} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

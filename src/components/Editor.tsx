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
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    // Check on mount and after content changes
    handleScroll();
    const observer = new ResizeObserver(handleScroll);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", handleScroll);
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
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-base max-w-none focus:outline-none min-h-[500px] p-6",
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
    <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-[#FFFEF9] relative">
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
        {/* Cursor Chat */}
        <CursorChat provider={provider} userName={userName} />
        {/* Session History */}
        <SessionHistory editor={editor} />
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
              <div className="absolute bottom-7 left-1/2 -translate-x-1/2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 text-xs text-gray-700">
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
            <span>{wordCount.words} words · {wordCount.chars} characters · {wordCount.words < 200 ? "< 1" : Math.ceil(wordCount.words / 200)} min read</span>
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

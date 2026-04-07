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
import "katex/dist/katex.min.css";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";
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

  // Track save status from Yjs sync events
  useEffect(() => {
    let saveTimer: ReturnType<typeof setTimeout>;
    const onUpdate = () => {
      setSaveStatus("saving");
      clearTimeout(saveTimer);
      // The WS provider sends updates immediately; the server persists after a debounce.
      // Mark as "saved" after 1.5s (matches the server's save debounce).
      saveTimer = setTimeout(() => {
        setSaveStatus("saved");
        setLastSyncTime(Date.now());
      }, 1500);
    };
    ydoc.on("update", onUpdate);
    return () => { ydoc.off("update", onUpdate); clearTimeout(saveTimer); };
  }, [ydoc]);

  // Tick the clock every 30s so "Saved Xm ago" updates
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="flex-1 overflow-auto bg-[#FFFEF9] relative">
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
      <EditorContent editor={editor} />
      <div className="sticky bottom-0 flex justify-between px-4 py-1.5 text-xs text-gray-400 bg-[#FFFEF9]/80 backdrop-blur-sm border-t border-gray-100">
        <span>
          {saveStatus === "saving" ? (
            "Saving..."
          ) : lastSyncTime ? (
            (() => {
              const ago = Math.floor((now - lastSyncTime) / 1000);
              if (ago < 10) return "Saved just now";
              if (ago < 60) return `Saved ${ago}s ago`;
              if (ago < 3600) return `Saved ${Math.floor(ago / 60)}m ago`;
              return `Saved ${new Date(lastSyncTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
            })()
          ) : ""}
        </span>
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
    </div>
  );
}

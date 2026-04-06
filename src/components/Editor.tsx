"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
// yCursorPlugin disabled — see note below
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark, commentDecorationKey } from "@/extensions/comment-mark";
import { Markdown } from "tiptap-markdown";
import { MermaidBlock } from "@/extensions/mermaid-block";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import SlashCommandMenu from "./SlashCommandMenu";
import { SearchReplace, searchReplacePluginKey } from "@/extensions/search-replace";
import SearchBar from "./SearchBar";

const CURSOR_COLORS = [
  "#f44336",
  "#e91e63",
  "#9c27b0",
  "#673ab7",
  "#3f51b5",
  "#2196f3",
  "#03a9f4",
  "#009688",
  "#4caf50",
  "#ff9800",
];

function getRandomColor() {
  return CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
}

// yCursorPlugin crashes in y-prosemirror 1.x with Tiptap v3 because
// awareness.doc is undefined during createDecorations. We set awareness
// user info so collaborator avatars in TopBar work, but skip the cursor
// rendering plugin until y-prosemirror ships a compatible version.

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
  documentId: _documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  editable = true,
  initialContent,
  onToggleShortcutsHelp,
}: EditorProps) {

  const cursorColor = useMemo(() => getRandomColor(), []);
  const [templateApplied, setTemplateApplied] = useState(false);
  const [slashMenu, setSlashMenu] = useState<{
    query: string;
    pos: { top: number; left: number };
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: cursorColor,
    });
  }, [provider, userName, cursorColor]);

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
      }),
      MermaidBlock,
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
      // Cursor plugin disabled — see comment above
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
        <span>{wordCount.words} words · {wordCount.chars} characters</span>
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

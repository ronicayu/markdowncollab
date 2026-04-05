"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
// yCursorPlugin disabled — see note below
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark, commentDecorationKey } from "@/extensions/comment-mark";
import { MermaidBlock } from "@/extensions/mermaid-block";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import SlashCommandMenu from "./SlashCommandMenu";

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
}

export default function Editor({
  documentId: _documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
}: EditorProps) {

  const cursorColor = useMemo(() => getRandomColor(), []);
  const [slashMenu, setSlashMenu] = useState<{
    query: string;
    pos: { top: number; left: number };
  } | null>(null);

  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: userName,
      color: cursorColor,
    });
  }, [provider, userName, cursorColor]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
        codeBlock: false, // replaced by MermaidBlock below
      }),
      MermaidBlock,
      Placeholder.configure({
        placeholder: "Start typing or paste markdown...",
      }),
      SuggestionMark,
      CommentMark,
      Collaboration.configure({
        document: ydoc,
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
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Drive the decoration plugin from React state — survives Tiptap view updates
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.view.state.tr.setMeta(commentDecorationKey, activeCommentId ?? null)
    );
  }, [editor, activeCommentId]);

  return (
    <div className="flex-1 overflow-auto bg-[#FFFEF9]">
      <EditorContent editor={editor} />
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

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
// yCursorPlugin disabled — see note below
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark } from "@/extensions/comment-mark";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";

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
}

export default function Editor({
  documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
}: EditorProps) {

  const cursorColor = useMemo(() => getRandomColor(), []);

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
      }),
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
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[500px] p-4",
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  return (
    <div className="flex-1 overflow-auto bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}

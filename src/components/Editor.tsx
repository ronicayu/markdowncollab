"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
// CollaborationCursor v2 is incompatible with tiptap v3 (crashes on provider.awareness.doc)
// TODO: Re-enable when @tiptap/extension-collaboration-cursor v3 is released
// import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark } from "@/extensions/comment-mark";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";
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
  const [connected, setConnected] = useState(
    () => (provider as unknown as { wsconnected?: boolean }).wsconnected ?? false
  );

  useEffect(() => {
    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === "connected");
    };
    provider.on("status", onStatus);
    // Check current state in case we missed the event
    if ((provider as unknown as { wsconnected?: boolean }).wsconnected) {
      setConnected(true);
    }
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  const cursorColor = useMemo(() => getRandomColor(), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      SuggestionMark,
      CommentMark,
      Collaboration.configure({
        document: ydoc,
      }),
      // CollaborationCursor disabled due to v2/v3 incompatibility
      // Cursors will be re-enabled when tiptap ships a v3-compatible version
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
    <div className="relative flex-1 overflow-auto bg-white">
      <EditorContent editor={editor} />
    </div>
  );
}

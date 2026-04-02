"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import { Extension } from "@tiptap/core";
import { yCursorPlugin } from "y-prosemirror";
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

const CustomCursorExtension = Extension.create({
  name: "customCursor",
  addOptions() {
    return {
      provider: null as WebsocketProvider | null,
    };
  },
  addProseMirrorPlugins() {
    const provider = this.options.provider as WebsocketProvider;
    if (!provider) return [];
    return [yCursorPlugin(provider.awareness)];
  },
});

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
      CustomCursorExtension.configure({
        provider,
      }),
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
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 text-xs text-gray-500">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            connected ? "bg-green-500" : "bg-yellow-500"
          }`}
          title={connected ? "Connected" : "Connecting..."}
        />
        {connected ? "Connected" : "Connecting..."}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

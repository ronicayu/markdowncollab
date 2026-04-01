"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { SuggestionMark } from "@/extensions/suggestion-mark";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";

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
}

export default function Editor({ documentId, userName }: EditorProps) {
  const [connected, setConnected] = useState(false);

  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234";
    const provider = new WebsocketProvider(wsUrl, documentId, ydoc);
    return { ydoc, provider };
  }, [documentId]);

  useEffect(() => {
    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === "connected");
    };
    provider.on("status", onStatus);
    return () => {
      provider.off("status", onStatus);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const cursorColor = useMemo(() => getRandomColor(), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: false,
      }),
      SuggestionMark,
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: userName,
          color: cursorColor,
        },
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

  return (
    <div className="relative flex-1 overflow-auto bg-white">
      {!connected && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs text-yellow-800">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          Connecting...
        </div>
      )}
      {connected && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs text-green-800">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          Connected
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

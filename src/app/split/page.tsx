"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect, useCallback, Suspense } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Editor from "@/components/Editor";
import Toolbar from "@/components/Toolbar";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useSession } from "next-auth/react";

function getUserName(session: any): string {
  if (session?.user?.name) return session.user.name;
  if (typeof window === "undefined") return "Anonymous";
  const stored = localStorage.getItem("markdown-collab-username");
  if (stored) return stored;
  return "Anonymous";
}

function SplitPane({ docId, userName }: { docId: string; userName: string }) {
  const [title, setTitle] = useState(docId);
  const [connected, setConnected] = useState(false);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/ws`;
    return new WebsocketProvider(wsUrl, docId, ydoc);
  }, [docId, ydoc]);

  useEffect(() => {
    const onStatus = ({ status }: { status: string }) =>
      setConnected(status === "connected");
    provider.on("status", onStatus);
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  useEffect(() => {
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/documents/${docId}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((doc) => {
        if (doc?.title) setTitle(doc.title);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch document:", err);
      });
    return () => controller.abort();
  }, [docId]);

  const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(null);
  const handleEditorReady = useCallback(
    (e: import("@tiptap/core").Editor) => setEditor(e),
    []
  );

  return (
    <div className="flex flex-col h-full border-r border-gray-200 last:border-r-0">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between bg-[#111110] px-3 py-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white/80 truncate">
            {title}
          </span>
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              connected ? "bg-[#0D9488]" : "bg-yellow-400"
            }`}
          />
        </div>
        <a
          href={`/doc/${docId}`}
          className="text-xs text-white/50 hover:text-white transition-colors"
        >
          Open full
        </a>
      </div>
      <Toolbar editor={editor} />
      <div className="flex-1 overflow-y-auto">
        <ErrorBoundary>
          <Editor
            documentId={docId}
            userName={userName}
            ydoc={ydoc}
            provider={provider}
            onEditorReady={handleEditorReady}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}

function SplitViewContent() {
  const searchParams = useSearchParams();
  const leftId = searchParams.get("left");
  const rightId = searchParams.get("right");
  const { data: session } = useSession();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setUserName(getUserName(session));
  }, [session]);

  if (!leftId || !rightId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F2E8D5]">
        <p className="text-gray-500">
          Missing document IDs. Use <code>?left=ID1&right=ID2</code>
        </p>
      </div>
    );
  }

  if (!userName) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F2E8D5]">
      <div className="flex-1 flex flex-col min-w-0">
        <SplitPane docId={leftId} userName={userName} />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <SplitPane docId={rightId} userName={userName} />
      </div>
    </div>
  );
}

export default function SplitViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <SplitViewContent />
    </Suspense>
  );
}

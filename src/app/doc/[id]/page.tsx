"use client";

import { use, useState, useCallback, useEffect, useMemo, useRef } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
import Editor from "@/components/Editor";
import Toolbar from "@/components/Toolbar";
import TopBar from "@/components/TopBar";
import type { Collaborator } from "@/components/TopBar";
import CommentSidebar from "@/components/CommentSidebar";
import OutlineSidebar from "@/components/OutlineSidebar";
import {
  getSuggestions,
  getComments,
  updateSuggestionStatus,
  addComment,
} from "@/lib/suggestion-store";
import { toast } from "@/lib/toast";
import type { Suggestion, Comment } from "@/types";

const ADJECTIVES = [
  "Swift",
  "Bright",
  "Calm",
  "Bold",
  "Keen",
  "Warm",
  "Cool",
  "Wild",
];
const ANIMALS = [
  "Fox",
  "Owl",
  "Bear",
  "Wolf",
  "Hawk",
  "Deer",
  "Lynx",
  "Hare",
];

function generateUserName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

function getUserName(): string {
  if (typeof window === "undefined") return "Anonymous";
  const stored = localStorage.getItem("markdown-collab-username");
  if (stored) return stored;
  const name = generateUserName();
  localStorage.setItem("markdown-collab-username", name);
  return name;
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    setUserName(getUserName());
  }, []);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(
    () =>
      new WebsocketProvider(
        process.env.NEXT_PUBLIC_WS_URL ||
          `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/ws`,
        id,
        ydoc
      ),
    [id, ydoc]
  );

  const [connected, setConnected] = useState(
    () => (provider as unknown as { wsconnected?: boolean }).wsconnected ?? false
  );

  useEffect(() => {
    const onStatus = ({ status }: { status: string }) => {
      setConnected(status === "connected");
    };
    provider.on("status", onStatus);
    if ((provider as unknown as { wsconnected?: boolean }).wsconnected) {
      setConnected(true);
    }
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  const [docTitle, setDocTitle] = useState(id);

  // Fetch document title on mount
  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (doc?.title) setDocTitle(doc.title);
      })
      .catch(() => {});
  }, [id]);

  const handleTitleChange = useCallback(
    async (newTitle: string) => {
      setDocTitle(newTitle);
      try {
        await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newTitle }),
        });
      } catch {
        // silently fail — title is already set optimistically
      }
    },
    [id]
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(
    null
  );

  // Track text selection state for comment button
  // Save last non-collapsed selection so we can use it even after blur
  const lastSelectionRef = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => {
    if (!editor) return;
    const onSelectionUpdate = () => {
      const { from, to } = editor.state.selection;
      const hasText = from !== to;
      setHasSelection(hasText);
      if (hasText) {
        lastSelectionRef.current = { from, to };
      }
    };
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => { editor.off("selectionUpdate", onSelectionUpdate); };
  }, [editor]);

  // Set awareness user info when userName is ready
  useEffect(() => {
    if (!userName) return;
    const color = `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`;
    provider.awareness.setLocalStateField("user", { name: userName, color });
  }, [provider, userName]);

  // Track live collaborators from awareness
  useEffect(() => {
    const updateCollaborators = () => {
      const states = provider.awareness.getStates();
      const users: Collaborator[] = [];
      states.forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return; // skip self
        const user = state.user;
        if (user?.name) {
          users.push({ name: user.name, color: user.color || "#6B7280", isAgent: false });
        }
      });
      // Add self first
      if (userName) {
        const selfState = states.get(ydoc.clientID);
        const selfColor = selfState?.user?.color || "#3B82F6";
        users.unshift({ name: userName + " (you)", color: selfColor });
      }
      setCollaborators(users);
    };
    provider.awareness.on("change", updateCollaborators);
    updateCollaborators();
    return () => {
      provider.awareness.off("change", updateCollaborators);
    };
  }, [provider, ydoc, userName]);

  useEffect(() => {
    const suggMap = ydoc.getMap("suggestions");
    const commMap = ydoc.getMap("comments");
    const updateState = () => {
      setSuggestions(getSuggestions(ydoc));
      setComments(getComments(ydoc));
    };
    suggMap.observe(updateState);
    commMap.observe(updateState);
    updateState();
    return () => {
      suggMap.unobserve(updateState);
      commMap.unobserve(updateState);
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, provider]);

  const handleAccept = useCallback(
    (suggestionId: string) => {
      const sugg = suggestions.find((s) => s.id === suggestionId);
      if (!sugg || !editor) return;
      const startAbs = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(sugg.startRelPos),
        ydoc
      );
      const endAbs = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(sugg.endRelPos),
        ydoc
      );
      if (startAbs && endAbs) {
        editor
          .chain()
          .setTextSelection({ from: startAbs.index + 1, to: endAbs.index + 1 })
          .insertContent(sugg.suggestedText)
          .unsetSuggestionMark()
          .run();
      }
      updateSuggestionStatus(ydoc, suggestionId, "accepted");
    },
    [ydoc, editor, suggestions]
  );

  const handleReject = useCallback(
    (suggestionId: string) => {
      if (!editor) return;
      const { doc } = editor.state;
      const markType = editor.schema.marks.suggestionMark;
      if (markType) {
        doc.descendants((node, pos) => {
          node.marks.forEach((mark) => {
            if (
              mark.type === markType &&
              mark.attrs.suggestionId === suggestionId
            ) {
              editor
                .chain()
                .setTextSelection({ from: pos, to: pos + node.nodeSize })
                .unsetSuggestionMark()
                .run();
            }
          });
        });
      }
      updateSuggestionStatus(ydoc, suggestionId, "rejected");
    },
    [ydoc, editor]
  );

  const handleClickItem = useCallback(
    (itemId: string) => {
      if (!editor) return;
      const sugg = suggestions.find((s) => s.id === itemId);
      const relPos = sugg?.startRelPos;
      if (!relPos) return;
      const abs = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(relPos),
        ydoc
      );
      if (abs) {
        editor.commands.setTextSelection(abs.index + 1);
        editor.commands.scrollIntoView();
      }
    },
    [editor, suggestions, ydoc]
  );

  const handleAddComment = useCallback(
    (text: string) => {
      if (!editor || !userName) return;
      const { from, to } = editor.state.selection;
      if (from === to) return; // no selection

      const yxml = ydoc.getXmlFragment("default");
      const startRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, from - 1)
      );
      const endRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, to - 1)
      );

      const comment: Comment = {
        id: generateId(),
        documentId: id,
        authorName: userName,
        authorType: "human",
        content: text,
        startRelPos,
        endRelPos,
        parentCommentId: null,
        resolved: false,
        createdAt: new Date().toISOString(),
      };

      addComment(ydoc, comment);

      // Apply highlight mark to selected text
      editor
        .chain()
        .setTextSelection({ from, to })
        .setMark("commentMark", { commentId: comment.id })
        .run();
    },
    [editor, userName, ydoc, id]
  );

  const [mobileCommentOpen, setMobileCommentOpen] = useState(false);
  const [savedSelection, setSavedSelection] = useState<{ from: number; to: number } | null>(null);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);

  function openMobileComment() {
    if (!editor) return;
    // Use the last saved non-collapsed selection (current selection may already
    // be collapsed on mobile because tapping the button blurs the editor)
    const sel = lastSelectionRef.current;
    if (!sel) return;
    setSavedSelection(sel);
    setMobileCommentOpen(true);
  }

  function handleMobileCommentSubmit() {
    const text = mobileTextareaRef.current?.value?.trim();
    if (!text || !editor || !userName || !savedSelection) return;
    const { from, to } = savedSelection;

    const yxml = ydoc.getXmlFragment("default");
    const startRelPos = Y.encodeRelativePosition(
      Y.createRelativePositionFromTypeIndex(yxml, from - 1)
    );
    const endRelPos = Y.encodeRelativePosition(
      Y.createRelativePositionFromTypeIndex(yxml, to - 1)
    );

    const comment: Comment = {
      id: generateId(),
      documentId: id,
      authorName: userName,
      authorType: "human",
      content: text,
      startRelPos,
      endRelPos,
      parentCommentId: null,
      resolved: false,
      createdAt: new Date().toISOString(),
    };

    addComment(ydoc, comment);

    editor
      .chain()
      .setTextSelection({ from, to })
      .setMark("commentMark", { commentId: comment.id })
      .run();

    if (mobileTextareaRef.current) mobileTextareaRef.current.value = "";
    setMobileCommentOpen(false);
    setSavedSelection(null);
  }

  const [agentLoading, setAgentLoading] = useState(false);

  const handleInviteAgent = useCallback(async () => {
    setAgentLoading(true);
    try {
      const res = await fetch("/api/agent/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error, "error");
      } else {
        const data = await res.json();
        toast(
          "Agent generated " + (data.suggestionsCount ?? 0) + " suggestions"
        );
      }
    } catch {
      toast("Failed to reach agent", "error");
    } finally {
      setAgentLoading(false);
    }
  }, [id]);

  if (!userName) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopBar
        title={docTitle}
        documentId={id}
        collaborators={collaborators}
        connected={connected}
        onInviteAgent={handleInviteAgent}
        onTitleChange={handleTitleChange}
        agentLoading={agentLoading}
      />
      <Toolbar editor={editor} />
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <OutlineSidebar editor={editor} />
        </div>
        <Editor
          documentId={id}
          userName={userName}
          ydoc={ydoc}
          provider={provider}
          onEditorReady={setEditor}
        />
        <div className="hidden md:block">
          <CommentSidebar
            suggestions={suggestions}
            comments={comments}
            onAcceptSuggestion={handleAccept}
            onRejectSuggestion={handleReject}
            onClickItem={handleClickItem}
            onAddComment={handleAddComment}
            hasSelection={hasSelection}
          />
        </div>
      </div>
      {/* Mobile: floating comment button when text is selected */}
      {hasSelection && (
        <button
          onClick={openMobileComment}
          className="md:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-blue-700 active:bg-blue-800"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          Comment
        </button>
      )}

      {/* Mobile: comment bottom sheet */}
      {mobileCommentOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/30" onClick={() => setMobileCommentOpen(false)}>
          <div className="bg-white rounded-t-2xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Add comment</h3>
            <textarea
              ref={mobileTextareaRef}
              autoFocus
              placeholder="Type your comment..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-400"
              rows={3}
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => { setMobileCommentOpen(false); }}
                className="flex-1 text-sm text-gray-600 border border-gray-200 rounded-lg py-2.5 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMobileCommentSubmit}
                className="flex-1 text-sm font-medium text-white bg-blue-600 rounded-lg py-2.5 hover:bg-blue-700 active:bg-blue-800"
              >
                Comment
              </button>
            </div>

            {/* Show existing comments */}
            {comments.filter((c) => !c.resolved).length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Comments</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {comments.filter((c) => !c.resolved).map((c) => (
                    <div key={c.id} className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                      <span className="font-medium text-gray-800">{c.authorName}</span>: {c.content}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

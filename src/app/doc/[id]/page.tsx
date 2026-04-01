"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Editor from "@/components/Editor";
import TopBar from "@/components/TopBar";
import type { Collaborator } from "@/components/TopBar";
import CommentSidebar from "@/components/CommentSidebar";
import OutlineSidebar from "@/components/OutlineSidebar";
import {
  getSuggestions,
  getComments,
  updateSuggestionStatus,
} from "@/lib/suggestion-store";
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
        `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/ws`,
        id,
        ydoc
      ),
    [id, ydoc]
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(
    null
  );

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

  const handleInviteAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Agent error: " + err.error);
      }
    } catch {
      alert("Failed to reach agent. Is the server running?");
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
        title={id}
        documentId={id}
        collaborators={collaborators}
        onInviteAgent={handleInviteAgent}
      />
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
          />
        </div>
      </div>
    </div>
  );
}

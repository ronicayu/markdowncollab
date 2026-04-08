"use client";

import { use, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
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
import { trackDocumentOpen } from "@/components/RecentDocs";
import Toolbar from "@/components/Toolbar";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import TopBar from "@/components/TopBar";
import type { Collaborator, BreadcrumbSegment } from "@/components/TopBar";
import { getFontFamily, type FontOption } from "@/components/FontSelector";
import CommentSidebar from "@/components/CommentSidebar";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";
import OutlineSidebar from "@/components/OutlineSidebar";
import FloatingCommentButton from "@/components/FloatingCommentButton";
import ErrorBoundary from "@/components/ErrorBoundary";
import TypingIndicator from "@/components/TypingIndicator";
import SaveTemplateDialog from "@/components/SaveTemplateDialog";
import PresentationMode from "@/components/PresentationMode";
import PinnedNotes from "@/components/PinnedNotes";
import AIChatSidebar from "@/components/AIChatSidebar";
import ReminderDialog from "@/components/ReminderDialog";
import ExpirationDialog from "@/components/ExpirationDialog";
import {
  getSuggestions,
  getComments,
  getRevisionRequests,
  updateSuggestionStatus,
  addComment,
  resolveComment,
  addReplyToComment,
  toggleCommentReaction,
  addRevisionRequest,
  resolveRevisionRequest,
} from "@/lib/suggestion-store";
import { toast } from "@/lib/toast";
import { getUserColor } from "@/lib/cursor-utils";
import type { Suggestion, Comment, RevisionRequest } from "@/types";

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

function collectActiveCommentIds(editorInstance: import("@tiptap/core").Editor): Set<string> {
  const ids = new Set<string>();
  editorInstance.state.doc.descendants((node) => {
    node.marks.forEach((mark) => {
      if (mark.type.name === "commentMark") {
        ids.add(mark.attrs.commentId as string);
      }
    });
  });
  return ids;
}

export default function DocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session } = useSession();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    // Prefer the Google account name; fall back to a stored/generated guest name
    setUserName(session?.user?.name ?? getUserName());
  }, [session]);

  // Read template content from sessionStorage (set by document list page)
  useEffect(() => {
    const key = `template:${id}`;
    const content = sessionStorage.getItem(key);
    if (content) {
      sessionStorage.removeItem(key);
      setTemplateContent(content);
    }
  }, [id]);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(() => {
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/ws`;

    // Append share token from URL if present
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");
      if (token) {
        wsUrl += (wsUrl.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
      }
    }

    return new WebsocketProvider(wsUrl, id, ydoc);
  }, [id, ydoc]);

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

  const [templateContent, setTemplateContent] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState(id);
  const [userRole, setUserRole] = useState<"owner" | "editor" | "viewer" | null>(null);
  const [docStatus, setDocStatus] = useState<string>("draft");
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbSegment[]>([]);
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lockedBy: string | null } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expirationDialogOpen, setExpirationDialogOpen] = useState(false);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  // Fetch document title, role, status, and breadcrumbs on mount
  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (doc?.title) setDocTitle(doc.title);
        if (doc?.role) setUserRole(doc.role);
        if (doc?.coverImage) setCoverImage(doc.coverImage);
        if (doc?.fontFamily) setFontFamily(doc.fontFamily);
        if (doc?.status) setDocStatus(doc.status);
        // Track recent document open for the RecentDocs widget
        trackDocumentOpen(id, doc?.title || id);
        if (typeof window !== "undefined") window.dispatchEvent(new Event("recentDocsUpdated"));
        // Fetch folder breadcrumb path if document is in a folder
        if (doc?.folderId) {
          fetch(`/api/folders/${doc.folderId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((path: BreadcrumbSegment[]) => {
              if (Array.isArray(path)) setBreadcrumbs(path);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [id]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      try {
        const res = await fetch(`/api/documents/${id}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        });
        if (res.ok) {
          const data = await res.json();
          setDocStatus(data.status);
          toast(`Status changed to ${data.status === "in_review" ? "In Review" : data.status === "approved" ? "Approved" : "Draft"}`);
        } else {
          const err = await res.json();
          toast(err.error || "Failed to change status", "error");
        }
      } catch {
        toast("Failed to change status", "error");
      }
    },
    [id]
  );

  // Fetch lock status on mount
  useEffect(() => {
    fetch(`/api/documents/${id}/lock`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setLockInfo({ locked: data.locked, lockedBy: data.lockedBy });
      })
      .catch(() => {});
  }, [id]);

  const handleToggleLock = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/${id}/lock`, { method: "PUT" });
      const data = await res.json();
      if (res.ok) {
        setLockInfo({ locked: data.locked, lockedBy: data.lockedBy });
        toast(data.locked ? `Document locked` : "Document unlocked");
      } else {
        toast(data.error || "Failed to toggle lock", "error");
      }
    } catch {
      toast("Failed to toggle lock", "error");
    }
  }, [id]);

  const handleSummarize = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/documents/${id}/summarize`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast(data.summary);
      } else {
        toast(data.error || "Failed to generate summary", "error");
      }
    } catch {
      toast("Failed to generate summary", "error");
    } finally {
      setSummaryLoading(false);
    }
  }, [id]);

  // Track document view on mount
  useEffect(() => {
    fetch(`/api/documents/${id}/analytics`, { method: "POST" }).catch(() => {});
  }, [id]);

  const handleCoverUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const uploadRes = await fetch(`/api/documents/${id}/upload`, { method: "POST", body: formData });
      if (!uploadRes.ok) return;
      const { url } = await uploadRes.json();
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: url }),
      });
      setCoverImage(url);
    } catch { /* silently fail */ }
    if (coverInputRef.current) coverInputRef.current.value = "";
  }, [id]);

  const handleRemoveCover = useCallback(async () => {
    try {
      await fetch(`/api/documents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coverImage: null }),
      });
      setCoverImage(null);
    } catch { /* silently fail */ }
  }, [id]);

  const handleFontChange = useCallback(
    async (font: FontOption) => {
      setFontFamily(font);
      try {
        await fetch(`/api/documents/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fontFamily: font }),
        });
      } catch {
        // silently fail — font is already set optimistically
      }
    },
    [id]
  );

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
  const [revisionRequests, setRevisionRequests] = useState<RevisionRequest[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [hasSelection, setHasSelection] = useState(false);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(
    null
  );
  const [activeCommentIds, setActiveCommentIds] = useState<Set<string>>(new Set());

  // Track comment form open state so the floating button hides when the form is open
  const [commentFormOpen, setCommentFormOpen] = useState(false);
  // Incrementing counter used to imperatively open the comment form from the floating button
  const [openFormTrigger, setOpenFormTrigger] = useState(0);

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

  // Detect clicks inside the editor: activate comment marks, clear when clicking elsewhere
  useEffect(() => {
    if (!editor) return;
    const editorEl = editor.view.dom;
    const handleClick = (e: Event) => {
      const target = (e.target as HTMLElement).closest("mark[data-comment-id]");
      if (target) {
        const commentId = target.getAttribute("data-comment-id");
        if (commentId) setActiveCommentId(commentId);
      } else {
        setActiveCommentId(null);
      }
    };
    editorEl.addEventListener("click", handleClick);
    return () => { editorEl.removeEventListener("click", handleClick); };
  }, [editor]);

  // Set awareness user info when userName is ready
  useEffect(() => {
    if (!userName) return;
    const color = getUserColor(userName);
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
    const revMap = ydoc.getMap("revision_requests");
    const updateState = () => {
      setSuggestions(getSuggestions(ydoc));
      setComments(getComments(ydoc));
      setRevisionRequests(getRevisionRequests(ydoc));
    };
    suggMap.observe(updateState);
    commMap.observe(updateState);
    revMap.observe(updateState);
    updateState();
    return () => {
      suggMap.unobserve(updateState);
      commMap.unobserve(updateState);
      revMap.unobserve(updateState);
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

      setActiveCommentId(itemId);

      // Scroll to the marked text in the editor
      const comm = comments.find((c) => c.id === itemId);
      if (comm) {
        const mark = editor.view.dom.querySelector(
          `mark[data-comment-id="${itemId}"]`
        );
        if (mark) {
          mark.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }

      // Fallback for suggestions: scroll via Yjs position
      const sugg = suggestions.find((s) => s.id === itemId);
      const startRel = sugg?.startRelPos ?? comm?.startRelPos;
      if (!startRel) return;
      const startAbs = Y.createAbsolutePositionFromRelativePosition(
        Y.decodeRelativePosition(startRel),
        ydoc
      );
      if (startAbs) {
        editor.commands.setTextSelection(startAbs.index + 1);
        editor.commands.scrollIntoView();
      }
    },
    [editor, suggestions, comments, ydoc]
  );

  const handleAddComment = useCallback(
    (text: string) => {
      if (!editor || !userName) return;
      // Use saved selection — the live selection may have collapsed when
      // the user clicked into the sidebar textarea.
      const sel = lastSelectionRef.current;
      if (!sel) return;
      const { from, to } = sel;

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

      lastSelectionRef.current = null;
      toast("Comment added");
    },
    [editor, userName, ydoc, id]
  );

  const handleAddRevisionRequest = useCallback(
    (text: string, assignee: string) => {
      if (!editor || !userName) return;
      const sel = lastSelectionRef.current;
      if (!sel) return;
      const { from, to } = sel;

      const yxml = ydoc.getXmlFragment("default");
      const startRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, from - 1)
      );
      const endRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, to - 1)
      );

      const request: RevisionRequest = {
        id: generateId(),
        documentId: id,
        authorName: userName,
        authorType: "human",
        content: text,
        assignee,
        status: "open",
        startRelPos,
        endRelPos,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };

      addRevisionRequest(ydoc, request);
      lastSelectionRef.current = null;
      toast("Revision request added");
    },
    [editor, userName, ydoc, id]
  );

  const handleResolveRevisionRequest = useCallback(
    (reqId: string) => {
      resolveRevisionRequest(ydoc, reqId);
      toast("Revision request resolved");
    },
    [ydoc]
  );

  const handleEditorReady = useCallback(
    (e: import("@tiptap/core").Editor) => {
      setEditor(e);
      setActiveCommentIds(collectActiveCommentIds(e));
      e.on("update", () => setActiveCommentIds(collectActiveCommentIds(e)));
      // Auto-focus the editor so the user can start typing immediately
      setTimeout(() => e.commands.focus("end"), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleResolveComment = useCallback(
    (commentId: string) => {
      if (!editor) return;
      // Collect all ranges that have this comment mark first, then remove them
      // in a single transaction to avoid stale positions from iterating while mutating.
      const { doc } = editor.state;
      const markType = editor.schema.marks.commentMark;
      if (markType) {
        // Gather ranges that carry this comment mark
        const ranges: { from: number; to: number }[] = [];
        doc.descendants((node, pos) => {
          if (!node.isInline) return;
          node.marks.forEach((mark) => {
            if (mark.type === markType && mark.attrs.commentId === commentId) {
              ranges.push({ from: pos, to: pos + node.nodeSize });
            }
          });
        });

        if (ranges.length > 0) {
          // Merge adjacent/overlapping ranges and apply in one transaction
          ranges.sort((a, b) => a.from - b.from);
          const merged: { from: number; to: number }[] = [ranges[0]];
          for (let i = 1; i < ranges.length; i++) {
            const last = merged[merged.length - 1];
            if (ranges[i].from <= last.to) {
              last.to = Math.max(last.to, ranges[i].to);
            } else {
              merged.push({ ...ranges[i] });
            }
          }

          // Build a single transaction that removes the mark from all ranges
          let tr = editor.state.tr;
          for (const { from, to } of merged) {
            tr = tr.removeMark(from, to, markType);
          }
          // Map the current selection through the transaction to avoid
          // "TextSelection endpoint not pointing into a node with inline content"
          // warnings when marks are removed and positions shift.
          tr = tr.setSelection(tr.selection.map(tr.doc, tr.mapping));
          editor.view.dispatch(tr);
        }
      }
      resolveComment(ydoc, commentId);
      toast("Comment resolved");
    },
    [editor, ydoc]
  );

  const handleReplyToComment = useCallback(
    (commentId: string, text: string) => {
      if (!userName) return;
      addReplyToComment(ydoc, commentId, {
        id: generateId(),
        text,
        author: userName,
        createdAt: new Date().toISOString(),
      });
    },
    [ydoc, userName]
  );

  const handleToggleReaction = useCallback(
    (commentId: string, emoji: string) => {
      if (!userName) return;
      toggleCommentReaction(ydoc, commentId, emoji, userName);
    },
    [ydoc, userName]
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
    toast("Comment added");
  }

  // Typing indicator: set awareness typing=true on edits, clear after 2s
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      provider.awareness.setLocalStateField("typing", true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        provider.awareness.setLocalStateField("typing", false);
      }, 2000);
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [editor, provider]);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const toggleShortcutsHelp = useCallback(() => setShortcutsOpen((prev) => !prev), []);

  // AI Auto-complete toggle (persisted to localStorage)
  const [autoCompleteEnabled, setAutoCompleteEnabled] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("autoComplete:enabled");
    if (stored === "true") setAutoCompleteEnabled(true);
  }, []);
  const toggleAutoComplete = useCallback(() => {
    setAutoCompleteEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("autoComplete:enabled", String(next));
      return next;
    });
  }, []);

  const [focusMode, setFocusMode] = useState(false);
  const toggleFocusMode = useCallback(() => setFocusMode((prev) => !prev), []);

  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), []);

  function toggleVersionHistory() {
    setVersionHistoryOpen((prev) => !prev);
  }

  // Keyboard shortcut: Cmd+Shift+F to toggle focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for bubble-menu-comment custom event to trigger comment form
  useEffect(() => {
    const handler = () => setOpenFormTrigger((n) => n + 1);
    window.addEventListener("bubble-menu-comment", handler);
    return () => window.removeEventListener("bubble-menu-comment", handler);
  }, []);

  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationContent, setPresentationContent] = useState("");

  const handleSaveAsTemplate = useCallback(async (name: string, description: string) => {
    if (!editor) return;
    // Get the current document content as HTML
    const content = editor.getHTML();
    const res = await fetch("/api/templates/custom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, content }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast(err.error || "Failed to save template", "error");
      throw new Error(err.error);
    }
    toast("Template saved");
  }, [editor]);

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
    <div id="main-content" className="flex h-screen flex-col bg-[#F2E8D5]">
      <TopBar
        title={docTitle}
        documentId={id}
        collaborators={collaborators}
        connected={connected}
        onInviteAgent={handleInviteAgent}
        onTitleChange={userRole === "viewer" ? undefined : handleTitleChange}
        agentLoading={agentLoading}
        userRole={userRole}
        onToggleVersionHistory={toggleVersionHistory}
        versionHistoryOpen={versionHistoryOpen}
        focusMode={focusMode}
        onToggleFocusMode={toggleFocusMode}
        documentStatus={docStatus}
        onStatusChange={handleStatusChange}
        onSaveAsTemplate={() => setSaveTemplateOpen(true)}
        onPresent={() => {
          if (editor) {
            setPresentationContent(editor.getHTML());
            setPresentationMode(true);
          }
        }}
        onToggleChat={toggleChat}
        chatOpen={chatOpen}
        breadcrumbs={breadcrumbs}
        onSetReminder={() => setReminderDialogOpen(true)}
        lockInfo={lockInfo}
        onToggleLock={handleToggleLock}
        onSummarize={handleSummarize}
        summaryLoading={summaryLoading}
        onSetExpiration={() => setExpirationDialogOpen(true)}
        fontFamily={(fontFamily as FontOption) ?? "default"}
        onFontChange={userRole !== "viewer" ? handleFontChange : undefined}
        autoCompleteEnabled={autoCompleteEnabled}
        onToggleAutoComplete={toggleAutoComplete}
      />
      {userRole !== "viewer" && !focusMode && !(lockInfo?.locked && lockInfo.lockedBy !== userName) && <Toolbar editor={editor} onToggleShortcutsHelp={toggleShortcutsHelp} />}
      {/* Cover Image Banner */}
      {!focusMode && (
        <div className="relative group shrink-0">
          <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
          {coverImage ? (
            <div className="relative w-full" style={{ maxHeight: 200 }}>
              <img src={coverImage} alt="Document cover" className="w-full object-cover" style={{ maxHeight: 200 }} />
              {userRole !== "viewer" && (
                <button
                  onClick={handleRemoveCover}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80"
                >
                  Remove cover
                </button>
              )}
              {userRole !== "viewer" && (
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-1 rounded hover:bg-black/80"
                >
                  Change cover
                </button>
              )}
            </div>
          ) : (
            userRole !== "viewer" && (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-all text-center"
              >
                + Add cover image
              </button>
            )
          )}
        </div>
      )}
      {!focusMode && <TypingIndicator provider={provider} currentClientId={ydoc.clientID} />}
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && (
          <div className="hidden lg:block">
            <ErrorBoundary>
              <OutlineSidebar editor={editor} documentId={id} />
            </ErrorBoundary>
          </div>
        )}
        {ydoc && provider && (
          <div className={`flex-1 flex flex-col transition-all duration-300 ${focusMode ? "max-w-[700px] mx-auto" : ""}`} style={{ fontFamily: getFontFamily(fontFamily) }}>
            {!focusMode && <PinnedNotes ydoc={ydoc} userName={userName} />}
            <ErrorBoundary>
              <Editor
                documentId={id}
                userName={userName}
                ydoc={ydoc}
                provider={provider}
                onEditorReady={handleEditorReady}
                activeCommentId={activeCommentId}
                editable={userRole !== "viewer" && !(lockInfo?.locked && lockInfo.lockedBy !== userName)}
                initialContent={templateContent}
                onToggleShortcutsHelp={toggleShortcutsHelp}
                autoCompleteEnabled={autoCompleteEnabled}
              />
            </ErrorBoundary>
          </div>
        )}
        {/* Floating "+ Comment" button that appears above selected text (desktop) */}
        {!focusMode && (
          <FloatingCommentButton
            editor={editor}
            onAddComment={() => setOpenFormTrigger((n) => n + 1)}
            commentFormOpen={commentFormOpen}
          />
        )}
        {!focusMode && <div className="hidden md:block">
          <ErrorBoundary>
          <CommentSidebar
            suggestions={suggestions}
            comments={comments}
            activeCommentIds={activeCommentIds}
            onAcceptSuggestion={handleAccept}
            onRejectSuggestion={handleReject}
            onClickItem={handleClickItem}
            onAddComment={handleAddComment}
            onResolveComment={handleResolveComment}
            onReplyToComment={handleReplyToComment}
            onToggleReaction={handleToggleReaction}
            hasSelection={hasSelection}
            activeCommentId={activeCommentId}
            openFormTrigger={openFormTrigger}
            onFormOpenChange={setCommentFormOpen}
            documentId={id}
            currentUserName={userName ?? undefined}
            currentUserId={(session?.user as any)?.id}
            revisionRequests={revisionRequests}
            onAddRevisionRequest={handleAddRevisionRequest}
            onResolveRevisionRequest={handleResolveRevisionRequest}
          />
          </ErrorBoundary>
        </div>}
        {versionHistoryOpen && !focusMode && (
          <VersionHistoryPanel
            documentId={id}
            isOpen={versionHistoryOpen}
            onClose={() => setVersionHistoryOpen(false)}
            userName={userName}
          />
        )}
        {chatOpen && !focusMode && (
          <AIChatSidebar
            documentId={id}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
      {/* Mobile: floating comment button when text is selected */}
      {hasSelection && (
        <button
          onClick={openMobileComment}
          className="md:hidden fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-[#B8692A] text-white px-4 py-3 rounded-full shadow-lg hover:bg-[#96541F] active:bg-[#7A4318]"
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
                className="flex-1 text-sm font-medium text-white bg-[#B8692A] rounded-lg py-2.5 hover:bg-[#96541F] active:bg-[#7A4318]"
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
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <SaveTemplateDialog
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        onSave={handleSaveAsTemplate}
      />
      {reminderDialogOpen && (
        <ReminderDialog
          documentId={id}
          onClose={() => setReminderDialogOpen(false)}
        />
      )}
      {presentationMode && (
        <PresentationMode
          content={presentationContent}
          onExit={() => setPresentationMode(false)}
        />
      )}
    </div>
  );
}

"use client";

import { use, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
import MobileToolbar from "@/components/MobileToolbar";
import KeyboardShortcutsDialog from "@/components/KeyboardShortcutsDialog";
import TopBar from "@/components/TopBar";
import type { Collaborator, BreadcrumbSegment } from "@/components/TopBar";
import { getFontFamily, type FontOption } from "@/components/FontSelector";
import CommentSidebar from "@/components/CommentSidebar";
import VersionHistoryPanel, { type DiffOverlayData } from "@/components/VersionHistoryPanel";
import DiffViewer from "@/components/DiffViewer";
import OutlineSidebar from "@/components/OutlineSidebar";
import RelatedDocs from "@/components/RelatedDocs";
import FloatingCommentButton from "@/components/FloatingCommentButton";
import ErrorBoundary from "@/components/ErrorBoundary";
import TypingIndicator from "@/components/TypingIndicator";
import SaveTemplateDialog from "@/components/SaveTemplateDialog";
import PresentationMode from "@/components/PresentationMode";
import PinnedNotes from "@/components/PinnedNotes";
import AIChatSidebar from "@/components/AIChatSidebar";
import ReminderDialog from "@/components/ReminderDialog";
import ExpirationDialog from "@/components/ExpirationDialog";
import EditorMinimap from "@/components/EditorMinimap";
import DocumentMetadata from "@/components/DocumentMetadata";
import TabBar, { trackTab } from "@/components/TabBar";
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
  const router = useRouter();
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
  const [hasPassword, setHasPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [expirationDialogOpen, setExpirationDialogOpen] = useState(false);
  const [publishAt, setPublishAt] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [forkedFrom, setForkedFrom] = useState<{ id: string; title: string } | null>(null);
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
        if (doc?.hasPassword) {
          setHasPassword(true);
          // Check sessionStorage for previously verified password
          const verified = sessionStorage.getItem(`doc-pw-verified:${id}`);
          if (verified === "true") setPasswordVerified(true);
        } else {
          setPasswordVerified(true);
        }
        // Track recent document open for the RecentDocs widget
        trackDocumentOpen(id, doc?.title || id);
        trackTab(id, doc?.title || "Untitled");
        if (typeof window !== "undefined") window.dispatchEvent(new Event("recentDocsUpdated"));
        // Fetch forked-from document info if applicable
        if (doc?.forkedFrom) {
          fetch(`/api/documents/${doc.forkedFrom}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((origDoc) => {
              if (origDoc) setForkedFrom({ id: origDoc.id, title: origDoc.title || "Untitled" });
            })
            .catch(() => {});
        }
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

    // Fetch schedule info
    fetch(`/api/documents/${id}/schedule`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.publishAt) setPublishAt(data.publishAt);
      })
      .catch(() => {});
  }, [id]);

  const handleSchedulePublish = useCallback(async (dateTime: string | null) => {
    try {
      const res = await fetch(`/api/documents/${id}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publishAt: dateTime }),
      });
      if (res.ok) {
        const data = await res.json();
        setPublishAt(data.publishAt);
        toast(dateTime ? `Publish scheduled for ${new Date(dateTime).toLocaleString()}` : "Schedule cleared");
      }
    } catch {
      toast("Failed to update schedule");
    }
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
      trackTab(id, newTitle);
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

  // Grammar check toggle (persisted to localStorage)
  const [grammarCheckEnabled, setGrammarCheckEnabled] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("grammarCheck:enabled");
    if (stored === "true") setGrammarCheckEnabled(true);
  }, []);
  const toggleGrammarCheck = useCallback(() => {
    setGrammarCheckEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("grammarCheck:enabled", String(next));
      return next;
    });
  }, []);

  const [metadataOpen, setMetadataOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const toggleFocusMode = useCallback(() => setFocusMode((prev) => !prev), []);

  // Zen Mode — enhanced focus with vignette, larger text, all chrome hidden
  const [zenMode, setZenMode] = useState(false);
  const toggleZenMode = useCallback(() => setZenMode((prev) => !prev), []);

  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [diffOverlay, setDiffOverlay] = useState<DiffOverlayData | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const toggleChat = useCallback(() => setChatOpen((prev) => !prev), []);

  function toggleVersionHistory() {
    setVersionHistoryOpen((prev) => !prev);
  }

  // Keyboard shortcut: Cmd+Shift+F to toggle focus mode
  // Keyboard shortcut: Cmd+Alt+Z to toggle zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key === "z") {
        e.preventDefault();
        setZenMode((prev) => !prev);
      }
      // Escape exits zen mode
      if (e.key === "Escape" && zenMode) {
        setZenMode(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [zenMode]);

  // Listen for bubble-menu-comment custom event to trigger comment form
  useEffect(() => {
    const handler = () => setOpenFormTrigger((n) => n + 1);
    window.addEventListener("bubble-menu-comment", handler);
    return () => window.removeEventListener("bubble-menu-comment", handler);
  }, []);

  // Sidebar resize state
  const [leftSidebarWidth, setLeftSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 240;
    const stored = localStorage.getItem("sidebar:left:width");
    return stored ? Math.max(150, Math.min(400, Number(stored))) : 240;
  });
  const [rightSidebarWidth, setRightSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 300;
    const stored = localStorage.getItem("sidebar:right:width");
    return stored ? Math.max(150, Math.min(400, Number(stored))) : 300;
  });
  const resizingRef = useRef<"left" | "right" | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      e.preventDefault();
      const delta = e.clientX - resizeStartXRef.current;
      const newWidth = resizingRef.current === "left"
        ? resizeStartWidthRef.current + delta
        : resizeStartWidthRef.current - delta;
      const clamped = Math.max(150, Math.min(400, newWidth));
      if (resizingRef.current === "left") {
        setLeftSidebarWidth(clamped);
      } else {
        setRightSidebarWidth(clamped);
      }
    };
    const handleMouseUp = () => {
      if (resizingRef.current === "left") {
        localStorage.setItem("sidebar:left:width", String(leftSidebarWidth));
      } else if (resizingRef.current === "right") {
        localStorage.setItem("sidebar:right:width", String(rightSidebarWidth));
      }
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [leftSidebarWidth, rightSidebarWidth]);

  const startResize = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    resizingRef.current = side;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = side === "left" ? leftSidebarWidth : rightSidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [leftSidebarWidth, rightSidebarWidth]);

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

  // AI Translate
  const [translateLoading, setTranslateLoading] = useState(false);

  const handleTranslate = useCallback(async (language: string) => {
    setTranslateLoading(true);
    try {
      const res = await fetch("/api/agent/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id, targetLanguage: language }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`Translated to ${language}. Opening new document...`);
        router.push(`/doc/${data.documentId}`);
      } else {
        toast(data.error || "Translation failed", "error");
      }
    } catch {
      toast("Failed to translate", "error");
    } finally {
      setTranslateLoading(false);
    }
  }, [id, router]);

  const [agentLoading, setAgentLoading] = useState(false);
  const [agentTone, setAgentTone] = useState("");

  const handleInviteAgent = useCallback(async () => {
    setAgentLoading(true);
    try {
      const res = await fetch("/api/agent/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id, tone: agentTone || undefined }),
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
  }, [id, agentTone]);

  const handlePasswordSubmit = useCallback(async () => {
    setPasswordError("");
    try {
      const res = await fetch(`/api/documents/${id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.verified) {
        setPasswordVerified(true);
        sessionStorage.setItem(`doc-pw-verified:${id}`, "true");
      } else {
        setPasswordError(data.error || "Incorrect password");
      }
    } catch {
      setPasswordError("Failed to verify password");
    }
  }, [id, passwordInput]);

  if (!userName) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (hasPassword && !passwordVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F2E8D5]">
        <div className="bg-white rounded-xl shadow-xl p-8 mx-4 max-w-sm w-full text-center">
          <svg className="h-10 w-10 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Password Protected</h2>
          <p className="text-sm text-gray-500 mb-5">This document requires a password to access.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePasswordSubmit(); }}
            placeholder="Enter password"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A] mb-3"
            autoFocus
          />
          {passwordError && <p className="text-xs text-red-500 mb-3">{passwordError}</p>}
          <button
            onClick={handlePasswordSubmit}
            disabled={!passwordInput}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-[#B8692A] hover:bg-[#96541F] rounded-lg transition-colors disabled:opacity-40"
          >
            Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className={`flex h-screen flex-col bg-[#F2E8D5] ${zenMode ? "zen-mode" : ""}`}
      onClick={zenMode ? (e) => {
        // Exit zen mode when clicking outside the editor text area
        const target = e.target as HTMLElement;
        if (!target.closest(".ProseMirror") && !target.closest("button")) {
          setZenMode(false);
        }
      } : undefined}
    >
      {!zenMode && <TopBar
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
        grammarCheckEnabled={grammarCheckEnabled}
        onToggleGrammarCheck={toggleGrammarCheck}
        forkedFrom={forkedFrom}
        onTranslate={handleTranslate}
        translateLoading={translateLoading}
        agentTone={agentTone}
        onAgentToneChange={setAgentTone}
        publishAt={publishAt}
        onSchedulePublish={userRole !== "viewer" ? handleSchedulePublish : undefined}
        onShowMetadata={() => setMetadataOpen(true)}
      />}
      {zenMode && (
        <div className="flex items-center justify-between bg-[#111110] px-4 py-2 shrink-0">
          <span className="text-sm font-semibold text-white/60">{docTitle}</span>
          <button
            onClick={() => setZenMode(false)}
            className="flex items-center gap-1.5 h-8 px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit Zen
          </button>
        </div>
      )}
      {!focusMode && !zenMode && <TabBar />}
      {userRole !== "viewer" && !focusMode && !zenMode && !(lockInfo?.locked && lockInfo.lockedBy !== userName) && <Toolbar editor={editor} onToggleShortcutsHelp={toggleShortcutsHelp} />}
      {userRole !== "viewer" && !focusMode && !zenMode && !(lockInfo?.locked && lockInfo.lockedBy !== userName) && <MobileToolbar editor={editor} />}
      {/* Cover Image Banner */}
      {!focusMode && !zenMode && (
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
      {!focusMode && !zenMode && <TypingIndicator provider={provider} currentClientId={ydoc.clientID} />}
      <div className="flex flex-1 overflow-hidden">
        {!focusMode && !zenMode && (
          <div className="hidden lg:flex shrink-0" style={{ width: leftSidebarWidth }}>
            <div className="flex-1 overflow-hidden">
              <ErrorBoundary>
                <OutlineSidebar editor={editor} documentId={id} ydoc={ydoc} currentUser={userName ?? undefined} />
                <RelatedDocs documentId={id} />
              </ErrorBoundary>
            </div>
            <div
              onMouseDown={(e) => startResize("left", e)}
              className="w-1 hover:w-1.5 bg-transparent hover:bg-[#B8692A]/30 transition-colors shrink-0"
              style={{ cursor: "col-resize" }}
              title="Drag to resize sidebar"
            />
          </div>
        )}
        {ydoc && provider && (
          <div className={`flex-1 flex flex-col transition-all duration-300 ${focusMode || zenMode ? "max-w-[700px] mx-auto" : ""}`} style={{ fontFamily: getFontFamily(fontFamily) }}>
            {!focusMode && !zenMode && <PinnedNotes ydoc={ydoc} userName={userName} />}
            <ErrorBoundary>
              <div className="relative flex-1 flex flex-col overflow-hidden">
                <div className={diffOverlay ? "invisible h-0 overflow-hidden" : "flex-1 flex flex-col"}>
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
                    grammarCheckEnabled={grammarCheckEnabled}
                  />
                </div>
                {diffOverlay && (
                  <div className="flex-1 flex flex-col bg-[#FFFEF9] overflow-auto">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 shrink-0">
                      <h3 className="text-sm font-semibold text-gray-700">Version Comparison</h3>
                      <button
                        onClick={() => setDiffOverlay(null)}
                        className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Back to editor
                      </button>
                    </div>
                    <div className="flex-1 overflow-auto px-4 py-3">
                      <DiffViewer
                        oldText={diffOverlay.oldText}
                        newText={diffOverlay.newText}
                        oldLabel={diffOverlay.oldLabel}
                        newLabel={diffOverlay.newLabel}
                      />
                    </div>
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </div>
        )}
        {/* Floating "+ Comment" button that appears above selected text (desktop) */}
        {!focusMode && !zenMode && (
          <FloatingCommentButton
            editor={editor}
            onAddComment={() => setOpenFormTrigger((n) => n + 1)}
            commentFormOpen={commentFormOpen}
          />
        )}
        {!focusMode && !zenMode && <div className="hidden md:flex shrink-0" style={{ width: rightSidebarWidth }}>
          <div
            onMouseDown={(e) => startResize("right", e)}
            className="w-1 hover:w-1.5 bg-transparent hover:bg-[#B8692A]/30 transition-colors shrink-0"
            style={{ cursor: "col-resize" }}
            title="Drag to resize sidebar"
          />
          <div className="flex-1 overflow-hidden">
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
          </div>
        </div>}
        {versionHistoryOpen && !focusMode && !zenMode && (
          <VersionHistoryPanel
            documentId={id}
            isOpen={versionHistoryOpen}
            onClose={() => setVersionHistoryOpen(false)}
            userName={userName}
            getCurrentMarkdown={editor ? () => {
              try {
                return (editor.storage as any).markdown?.getMarkdown?.() ?? editor.state.doc.textContent;
              } catch { return editor.state.doc.textContent; }
            } : undefined}
            onDiffOverlay={setDiffOverlay}
          />
        )}
        {chatOpen && !focusMode && !zenMode && (
          <AIChatSidebar
            documentId={id}
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
          />
        )}
        {/* Editor Minimap */}
        {!focusMode && !zenMode && <EditorMinimap editor={editor} />}
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
      <DocumentMetadata
        documentId={id}
        isOpen={metadataOpen}
        onClose={() => setMetadataOpen(false)}
      />
    </div>
  );
}

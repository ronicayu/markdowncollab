"use client";

import { useState, useEffect, useRef } from "react";
import type { Suggestion, Comment, RevisionRequest } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";
import RevisionRequestCard from "./RevisionRequestCard";
import MentionAutocomplete, { type MentionUser } from "./MentionAutocomplete";
import { formatMention, notifyMentions } from "@/lib/mention-utils";

type Filter = "open" | "resolved" | "all";

interface CommentSidebarProps {
  suggestions: Suggestion[];
  comments: Comment[];
  activeCommentIds: Set<string>;
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClickItem: (id: string) => void;
  onAddComment: (text: string) => void;
  onResolveComment: (id: string) => void;
  onReplyToComment: (commentId: string, text: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
  hasSelection: boolean;
  /** True when cursor is inside a block but no text is selected */
  hasCursorInBlock?: boolean;
  activeCommentId?: string | null;
  /** Increment this value to imperatively open the comment form (e.g. from the floating button). */
  openFormTrigger?: number;
  /** Called whenever the comment form opens or closes, so the parent can track it. */
  onFormOpenChange?: (isOpen: boolean) => void;
  documentId?: string;
  currentUserName?: string;
  currentUserId?: string;
  revisionRequests?: RevisionRequest[];
  onAddRevisionRequest?: (text: string, assignee: string) => void;
  onResolveRevisionRequest?: (id: string) => void;
  onAddBlockComment?: (text: string) => void;
}

export default function CommentSidebar({
  suggestions,
  comments,
  activeCommentIds,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClickItem,
  onAddComment,
  onResolveComment,
  onReplyToComment,
  onToggleReaction,
  hasSelection,
  activeCommentId,
  openFormTrigger,
  onFormOpenChange,
  documentId,
  currentUserName,
  currentUserId,
  revisionRequests,
  onAddRevisionRequest,
  onResolveRevisionRequest,
  hasCursorInBlock,
  onAddBlockComment,
}: CommentSidebarProps) {
  const [commentText, setCommentText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [revisionAssignee, setRevisionAssignee] = useState("");
  const [filter, setFilter] = useState<Filter>("open");
  const [collapsed, setCollapsed] = useState(true);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch collaborators for mention autocomplete
  useEffect(() => {
    if (!documentId) return;
    const controller = new AbortController();
    fetch(`/api/documents/${documentId}/collaborators`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((users: MentionUser[]) => setMentionUsers(users))
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch collaborators:", err);
      });
    return () => controller.abort();
  }, [documentId]);

  // Open the comment form whenever the trigger counter increments
  useEffect(() => {
    if (openFormTrigger && openFormTrigger > 0 && filter !== "resolved") {
      setShowInput(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openFormTrigger]);

  // Notify parent when showInput changes
  useEffect(() => {
    onFormOpenChange?.(showInput);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInput]);

  // Auto-expand when comments/suggestions appear, or when form opens
  const hasContent = comments.length > 0 || suggestions.length > 0;
  useEffect(() => {
    if (hasContent || showInput) setCollapsed(false);
  }, [hasContent, showInput]);

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === "pending" || s.status === "stale"
  );

  const filteredComments = comments.filter((c) => {
    if (filter === "open") return !c.resolved;
    if (filter === "resolved") return c.resolved;
    return true;
  });

  function handleSubmit() {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    if (hasSelection) {
      onAddComment(text);
    } else if (hasCursorInBlock && onAddBlockComment) {
      onAddBlockComment(text);
    } else {
      onAddComment(text);
    }
    // Fire-and-forget mention notifications
    if (documentId && currentUserName) {
      notifyMentions(documentId, text, currentUserName, currentUserId);
    }
    setCommentText("");
    setShowInput(false);
  }

  function closeForm() {
    setShowInput(false);
    setCommentText("");
  }

  function handleMentionSelect(user: MentionUser) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = commentText.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const mention = formatMention(user.name, user.id);
    const before = commentText.slice(0, atIndex);
    const after = commentText.slice(cursorPos);
    const newText = before + mention + " " + after;
    setCommentText(newText);
    setShowMentions(false);

    // Restore focus
    setTimeout(() => {
      textarea.focus();
      const newPos = atIndex + mention.length + 1;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  if (collapsed) {
    return (
      <div className="shrink-0 border-l border-[#eeeceb] bg-[#ffffff] p-2 flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md text-[#a39e98] hover:text-[#615d59] hover:bg-[#eeeceb] transition-colors"
          title="Show comments"
          aria-label="Show comments"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-[#eeeceb] bg-[#ffffff] p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <h2 className="text-sm font-semibold text-[#31302e]">Comments</h2>
          {!hasContent && !showInput && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-0.5 rounded text-[#a39e98] hover:text-[#615d59]"
              title="Hide comments"
              aria-label="Hide comments"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={filter}
          aria-label="Filter comments"
          onChange={(e) => {
            const next = e.target.value as Filter;
            setFilter(next);
            if (next === "resolved") {
              closeForm();
            }
          }}
          className="text-xs border border-[#dddddd] rounded-md px-1.5 py-1 bg-[#ffffff] text-[#615d59] focus:outline-none focus:border-[#0075de] cursor-pointer"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        {(hasSelection || hasCursorInBlock) && filter !== "resolved" && (
          <button
            onClick={() => setShowInput(true)}
            className="text-xs font-medium text-[#0075de] hover:text-[#005bab] shrink-0"
          >
            {hasSelection ? "+ Comment" : "+ Block Comment"}
          </button>
        )}
      </div>

      {/* New comment input */}
      {showInput && (
        <div className="mb-3 rounded-lg border border-[#dddddd] bg-[#ffffff] p-3">
          <p className="text-xs text-[#615d59] mb-2">{hasSelection ? "Comment on selected text:" : "Comment on this block:"}</p>
          <div className="relative">
            <MentionAutocomplete
              users={mentionUsers}
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onDismiss={() => setShowMentions(false)}
              visible={showMentions}
            />
            <textarea
              ref={textareaRef}
              autoFocus
              aria-label="Comment text"
              value={commentText}
              onChange={(e) => {
                const value = e.target.value;
                setCommentText(value);
                const cursorPos = e.target.selectionStart;
                const textBeforeCursor = value.slice(0, cursorPos);
                const atMatch = textBeforeCursor.match(/@(\w*)$/);
                if (atMatch) {
                  setMentionQuery(atMatch[1]);
                  setShowMentions(true);
                } else {
                  setShowMentions(false);
                }
              }}
              onKeyDown={(e) => {
                if (showMentions) return; // Let autocomplete handle keys
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
                if (e.key === "Escape") {
                  closeForm();
                }
              }}
              placeholder="Type your comment... Use @ to mention"
              className="w-full text-sm border border-[rgba(0,0,0,0.1)] rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#0075de]"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={closeForm}
              className="text-xs text-[#615d59] hover:text-[#31302e] px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              className="text-xs font-medium text-white bg-[#0075de] hover:bg-[#005bab] disabled:bg-[#dddddd] px-3 py-1 rounded-md"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-xs font-medium text-[#615d59] uppercase tracking-wide">
            Suggestions ({pendingSuggestions.length})
          </p>
          {pendingSuggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAccept={onAcceptSuggestion}
              onReject={onRejectSuggestion}
              onClick={onClickItem}
            />
          ))}
        </div>
      )}

      {/* Comments */}
      {filteredComments.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-[#615d59] uppercase tracking-wide">
            Comments ({filteredComments.length})
          </p>
          {filteredComments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onClick={onClickItem}
              onResolve={onResolveComment}
              onReply={onReplyToComment}
              onToggleReaction={onToggleReaction}
              currentUserName={currentUserName}
              isActive={c.id === activeCommentId}
              isContentDeleted={!c.resolved && !activeCommentIds.has(c.id)}
            />
          ))}
        </div>
      )}

      {/* Revision Requests */}
      {revisionRequests && revisionRequests.length > 0 && (
        <div className="flex flex-col gap-2 mt-3">
          <p className="text-xs font-medium text-[#dd5b00] uppercase tracking-wide">
            Revision Requests ({revisionRequests.filter((r) =>
              filter === "open" ? r.status === "open" :
              filter === "resolved" ? r.status === "resolved" : true
            ).length})
          </p>
          {revisionRequests
            .filter((r) =>
              filter === "open" ? r.status === "open" :
              filter === "resolved" ? r.status === "resolved" : true
            )
            .map((r) => (
              <RevisionRequestCard
                key={r.id}
                request={r}
                onClick={onClickItem}
                onResolve={onResolveRevisionRequest || (() => {})}
                isActive={r.id === activeCommentId}
              />
            ))}
        </div>
      )}

      {/* Request Change button */}
      {hasSelection && onAddRevisionRequest && filter !== "resolved" && (
        <>
          {!showRevisionInput ? (
            <button
              onClick={() => setShowRevisionInput(true)}
              className="mt-3 w-full text-xs font-medium text-[#dd5b00] hover:text-[#dd5b00] border border-[rgba(221,91,0,0.3)] rounded-md px-3 py-2 hover:bg-[#fbece0] transition-colors"
            >
              Request Change
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-[rgba(221,91,0,0.4)] bg-[#ffffff] p-3">
              <p className="text-xs text-[#615d59] mb-2">Request a change on selected text:</p>
              <textarea
                autoFocus
                aria-label="Revision request description"
                value={revisionText}
                onChange={(e) => setRevisionText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setShowRevisionInput(false);
                    setRevisionText("");
                    setRevisionAssignee("");
                  }
                }}
                placeholder="Describe the requested change..."
                className="w-full text-sm border border-[rgba(0,0,0,0.1)] rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#dd5b00] mb-2"
                rows={2}
              />
              <input
                type="text"
                value={revisionAssignee}
                onChange={(e) => setRevisionAssignee(e.target.value)}
                placeholder="Assignee name..."
                className="w-full text-sm border border-[rgba(0,0,0,0.1)] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#dd5b00] mb-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRevisionInput(false);
                    setRevisionText("");
                    setRevisionAssignee("");
                  }}
                  className="text-xs text-[#615d59] hover:text-[#31302e] px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (revisionText.trim() && revisionAssignee.trim()) {
                      onAddRevisionRequest(revisionText.trim(), revisionAssignee.trim());
                      setRevisionText("");
                      setRevisionAssignee("");
                      setShowRevisionInput(false);
                    }
                  }}
                  disabled={!revisionText.trim() || !revisionAssignee.trim()}
                  className="text-xs font-medium text-white bg-[#dd5b00] hover:bg-[#b14800] disabled:bg-[#dddddd] px-3 py-1 rounded-md"
                >
                  Request
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {filteredComments.length === 0 && pendingSuggestions.length === 0 && !showInput &&
        (!revisionRequests || revisionRequests.filter((r) =>
          filter === "open" ? r.status === "open" :
          filter === "resolved" ? r.status === "resolved" : true
        ).length === 0) && (
        <p className="text-xs text-[#a39e98]">
          {filter === "resolved"
            ? "No resolved items yet."
            : hasSelection
            ? 'Select text and click "+ Comment" to leave a comment.'
            : hasCursorInBlock
            ? 'Click "+ Block Comment" to comment on the current block.'
            : "Select text or place cursor in a block to add comments."}
        </p>
      )}
    </div>
  );
}

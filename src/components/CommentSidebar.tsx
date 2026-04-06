"use client";

import { useState, useEffect } from "react";
import type { Suggestion, Comment } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";

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
  hasSelection: boolean;
  activeCommentId?: string | null;
  /** Increment this value to imperatively open the comment form (e.g. from the floating button). */
  openFormTrigger?: number;
  /** Called whenever the comment form opens or closes, so the parent can track it. */
  onFormOpenChange?: (isOpen: boolean) => void;
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
  hasSelection,
  activeCommentId,
  openFormTrigger,
  onFormOpenChange,
}: CommentSidebarProps) {
  const [commentText, setCommentText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");
  const [collapsed, setCollapsed] = useState(true);

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
    onAddComment(commentText.trim());
    setCommentText("");
    setShowInput(false);
  }

  function closeForm() {
    setShowInput(false);
    setCommentText("");
  }

  if (collapsed) {
    return (
      <div className="shrink-0 border-l border-[#E8D8C0] bg-[#F5EBD8] p-2 flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
          title="Show comments"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-[#E8D8C0] bg-[#F5EBD8] p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <h2 className="text-sm font-semibold text-gray-700">Comments</h2>
          {!hasContent && !showInput && (
            <button
              onClick={() => setCollapsed(true)}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600"
              title="Hide comments"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        <select
          value={filter}
          onChange={(e) => {
            const next = e.target.value as Filter;
            setFilter(next);
            if (next === "resolved") {
              closeForm();
            }
          }}
          className="text-xs border border-[#D4A978] rounded-md px-1.5 py-1 bg-[#FFFEF9] text-gray-600 focus:outline-none focus:border-[#B8692A] cursor-pointer"
        >
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        {hasSelection && filter !== "resolved" && (
          <button
            onClick={() => setShowInput(true)}
            className="text-xs font-medium text-[#B8692A] hover:text-[#96541F] shrink-0"
          >
            + Comment
          </button>
        )}
      </div>

      {/* New comment input */}
      {showInput && (
        <div className="mb-3 rounded-lg border border-[#D4A978] bg-[#FFFEF9] p-3">
          <p className="text-xs text-gray-500 mb-2">Comment on selected text:</p>
          <textarea
            autoFocus
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
              if (e.key === "Escape") {
                closeForm();
              }
            }}
            placeholder="Type your comment..."
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#B8692A]"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={closeForm}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!commentText.trim()}
              className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-3 py-1 rounded-md"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
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
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Comments ({filteredComments.length})
          </p>
          {filteredComments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onClick={onClickItem}
              onResolve={onResolveComment}
              onReply={onReplyToComment}
              isActive={c.id === activeCommentId}
              isContentDeleted={!c.resolved && !activeCommentIds.has(c.id)}
            />
          ))}
        </div>
      )}

      {filteredComments.length === 0 && pendingSuggestions.length === 0 && !showInput && (
        <p className="text-xs text-gray-400">
          {filter === "resolved"
            ? "No resolved comments yet."
            : hasSelection
            ? 'Select text and click "+ Comment" to leave a comment.'
            : "Select text in the editor to add comments."}
        </p>
      )}
    </div>
  );
}

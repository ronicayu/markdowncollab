"use client";

import { useState } from "react";
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
  hasSelection: boolean;
  activeCommentId?: string | null;
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
  hasSelection,
  activeCommentId,
}: CommentSidebarProps) {
  const [commentText, setCommentText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [filter, setFilter] = useState<Filter>("open");

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

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-[#E8D8C0] bg-[#F5EBD8] p-3">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="text-sm font-semibold text-gray-700 shrink-0">Comments</h2>
        <select
          value={filter}
          onChange={(e) => {
            const next = e.target.value as Filter;
            setFilter(next);
            if (next === "resolved") {
              setShowInput(false);
              setCommentText("");
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
                setShowInput(false);
                setCommentText("");
              }
            }}
            placeholder="Type your comment..."
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-[#B8692A]"
            rows={2}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowInput(false); setCommentText(""); }}
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

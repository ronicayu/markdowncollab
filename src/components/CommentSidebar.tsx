"use client";

import { useState } from "react";
import type { Suggestion, Comment } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";

interface CommentSidebarProps {
  suggestions: Suggestion[];
  comments: Comment[];
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClickItem: (id: string) => void;
  onAddComment: (text: string) => void;
  hasSelection: boolean;
}

export default function CommentSidebar({
  suggestions,
  comments,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClickItem,
  onAddComment,
  hasSelection,
}: CommentSidebarProps) {
  const [commentText, setCommentText] = useState("");
  const [showInput, setShowInput] = useState(false);

  const pendingSuggestions = suggestions.filter(
    (s) => s.status === "pending" || s.status === "stale"
  );
  const unresolvedComments = comments.filter((c) => !c.resolved);

  function handleSubmit() {
    if (!commentText.trim()) return;
    onAddComment(commentText.trim());
    setCommentText("");
    setShowInput(false);
  }

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Comments</h2>
        {hasSelection && (
          <button
            onClick={() => setShowInput(true)}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            + Comment
          </button>
        )}
      </div>

      {/* New comment input */}
      {showInput && (
        <div className="mb-3 rounded-lg border border-blue-200 bg-white p-3">
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
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 resize-none focus:outline-none focus:border-blue-400"
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
              className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 px-3 py-1 rounded-md"
            >
              Comment
            </button>
          </div>
        </div>
      )}

      {/* Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
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
      {unresolvedComments.length > 0 && (
        <div className="flex flex-col gap-2">
          {unresolvedComments.map((c) => (
            <CommentCard key={c.id} comment={c} onClick={onClickItem} />
          ))}
        </div>
      )}

      {pendingSuggestions.length === 0 && unresolvedComments.length === 0 && !showInput && (
        <p className="text-xs text-gray-400">
          {hasSelection
            ? 'Select text and click "+ Comment" to leave a comment.'
            : "Select text in the editor to add comments."}
        </p>
      )}
    </div>
  );
}

"use client";

import type { Suggestion, Comment } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";

interface CommentSidebarProps {
  suggestions: Suggestion[];
  comments: Comment[];
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClickItem: (id: string) => void;
}

export default function CommentSidebar({
  suggestions,
  comments,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClickItem,
}: CommentSidebarProps) {
  const pendingSuggestions = suggestions.filter(
    (s) => s.status === "pending" || s.status === "stale"
  );
  const unresolvedComments = comments.filter((c) => !c.resolved);

  const isEmpty = pendingSuggestions.length === 0 && unresolvedComments.length === 0;

  return (
    <div className="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-3">
      <h2 className="mb-3 text-sm font-semibold text-gray-700">
        Suggestions &amp; Comments
      </h2>

      {isEmpty ? (
        <p className="text-xs text-gray-400">
          No suggestions or comments yet. Invite an agent to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pendingSuggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onAccept={onAcceptSuggestion}
              onReject={onRejectSuggestion}
              onClick={onClickItem}
            />
          ))}
          {unresolvedComments.map((c) => (
            <CommentCard
              key={c.id}
              comment={c}
              onClick={onClickItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { Comment } from "@/types";
import { renderMentionText } from "@/lib/mention-utils";

const REACTION_EMOJIS = ["\uD83D\uDC4D", "\u2764\uFE0F", "\uD83D\uDC40", "\uD83D\uDD25", "\uD83C\uDF89", "\uD83E\uDD14"];

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
  onReply: (commentId: string, text: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
  currentUserName?: string;
  isActive?: boolean;
  isContentDeleted: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  // Use a locale-independent format to avoid server/client hydration mismatches
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ReactionBar({
  reactions,
  commentId,
  currentUserName,
  onToggleReaction,
}: {
  reactions?: Record<string, string[]>;
  commentId: string;
  currentUserName?: string;
  onToggleReaction: (commentId: string, emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {REACTION_EMOJIS.map((emoji) => {
        const reactors = reactions?.[emoji] || [];
        const count = reactors.length;
        if (count === 0) return null;
        const isReacted = currentUserName ? reactors.includes(currentUserName) : false;
        return (
          <button
            key={emoji}
            onClick={() => onToggleReaction(commentId, emoji)}
            title={reactors.join(", ")}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
              isReacted
                ? "bg-[#fbece0] border border-[rgba(221,91,0,0.5)]"
                : "bg-[#f6f5f4] border border-[rgba(0,0,0,0.1)] hover:bg-[#dddddd]"
            }`}
          >
            <span>{emoji}</span>
            <span className="text-[#615d59] font-medium">{count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[#a39e98] hover:text-[#615d59] hover:bg-[#f6f5f4] text-xs transition-colors"
          title="Add reaction"
        >
          +
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 flex items-center gap-0.5 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg shadow-lg p-1 z-10">
            {REACTION_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => {
                  onToggleReaction(commentId, em);
                  setPickerOpen(false);
                }}
                className="text-sm hover:scale-125 transition-transform p-0.5 rounded hover:bg-[#f6f5f4]"
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommentCard({
  comment,
  onClick,
  onResolve,
  onReply,
  onToggleReaction,
  currentUserName,
  isActive,
  isContentDeleted,
}: CommentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const isAgent = comment.authorType === "agent";

  const accentColor = isAgent ? "var(--ai)" : "var(--warn)";
  const cardClass = comment.resolved
    ? "relative rounded-lg border border-[rgba(0,0,0,0.1)] bg-[#f6f5f4] p-3 pl-4 shadow-sm opacity-60"
    : isActive
    ? "cursor-pointer relative rounded-lg border border-[#dddddd] bg-white p-3 pl-4 shadow-sm transition-all hover:shadow-md"
    : "cursor-pointer relative rounded-lg border border-[#eeeceb] bg-white p-3 pl-4 shadow-sm transition-all hover:shadow-md";

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => !comment.resolved && onClick(comment.id)}
    >
      <span
        aria-hidden
        className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-sm"
        style={{ background: accentColor, opacity: isActive ? 1 : 0.65 }}
      />
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${
            isAgent ? "bg-[var(--ai)]" : "bg-green-600"
          }`}
        >
          {isAgent ? (
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47-2.47"
              />
            </svg>
          ) : (
            getInitials(comment.authorName)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${comment.resolved ? "text-[#615d59]" : "text-[#31302e]"}`}>
            {comment.authorName}
          </span>
          <span className="ml-2 text-xs text-[#a39e98]">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
      </div>

      <p className={`mb-2 text-sm ${comment.resolved ? "text-[#a39e98]" : "text-[#615d59]"}`}>
        {renderMentionText(comment.content).map((part, i) =>
          part.type === "mention" ? (
            <span key={i} className="text-[#b4783c] font-semibold">
              @{part.content}
            </span>
          ) : (
            <span key={i}>{part.content}</span>
          )
        )}
      </p>

      {/* Reactions */}
      {!comment.resolved && onToggleReaction && (
        <ReactionBar
          reactions={comment.reactions}
          commentId={comment.id}
          currentUserName={currentUserName}
          onToggleReaction={onToggleReaction}
        />
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className={`mb-2 pl-3 border-l-2 space-y-2 ${comment.resolved ? "border-[rgba(0,0,0,0.1)]" : "border-[rgba(221,91,0,0.3)]"}`}>
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <span className={`font-medium ${comment.resolved ? "text-[#a39e98]" : "text-[#31302e]"}`}>
                {reply.author}
              </span>
              <span className="ml-1.5 text-[#a39e98]">{formatTimestamp(reply.createdAt)}</span>
              <p className={`mt-0.5 ${comment.resolved ? "text-[#a39e98]" : "text-[#615d59]"}`}>
                {renderMentionText(reply.text).map((part, i) =>
                  part.type === "mention" ? (
                    <span key={i} className="text-[#b4783c] font-semibold">
                      @{part.content}
                    </span>
                  ) : (
                    <span key={i}>{part.content}</span>
                  )
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {comment.resolved ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Resolved
        </span>
      ) : (
        <>
          <div className="flex items-center justify-between">
            {isContentDeleted && (
              <span className="text-xs text-[#dd5b00] font-medium">Content deleted</span>
            )}
            <div className={`flex items-center gap-3 ${!isContentDeleted ? "ml-auto" : ""}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReplyInput((v) => !v);
                  setReplyText("");
                }}
                className="text-xs font-medium text-[#a39e98] hover:text-[#0075de] transition-colors"
              >
                Reply
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(comment.id);
                }}
                className="text-xs font-medium text-[#a39e98] hover:text-green-600 transition-colors"
              >
                Resolve
              </button>
            </div>
          </div>

          {/* Inline reply input */}
          {showReplyInput && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                autoFocus
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (replyText.trim()) {
                      onReply(comment.id, replyText.trim());
                      setReplyText("");
                      setShowReplyInput(false);
                    }
                  }
                  if (e.key === "Escape") {
                    setShowReplyInput(false);
                    setReplyText("");
                  }
                }}
                placeholder="Write a reply..."
                rows={2}
                className="w-full text-xs border border-[rgba(0,0,0,0.1)] rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-[#0075de]"
              />
              <div className="flex justify-end gap-2 mt-1.5">
                <button
                  onClick={() => { setShowReplyInput(false); setReplyText(""); }}
                  className="text-xs text-[#615d59] hover:text-[#31302e] px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (replyText.trim()) {
                      onReply(comment.id, replyText.trim());
                      setReplyText("");
                      setShowReplyInput(false);
                    }
                  }}
                  disabled={!replyText.trim()}
                  className="text-xs font-medium text-white bg-[#0075de] hover:bg-[#005bab] disabled:bg-[#dddddd] px-2.5 py-1 rounded-md"
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

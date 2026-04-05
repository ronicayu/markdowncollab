"use client";

import { useEffect, useRef, useState } from "react";
import type { Comment } from "@/types";

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
  onReply: (commentId: string, text: string) => void;
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
  return date.toLocaleDateString();
}

export default function CommentCard({
  comment,
  onClick,
  onResolve,
  onReply,
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

  const cardClass = comment.resolved
    ? "rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm opacity-60"
    : isActive
    ? "cursor-pointer rounded-lg border border-amber-400 bg-amber-50 p-3 ring-2 ring-amber-300 shadow-sm transition-all hover:shadow-md"
    : "cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all hover:shadow-md";

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => !comment.resolved && onClick(comment.id)}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${
            isAgent ? "bg-gray-700" : "bg-green-600"
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
          <span className={`text-sm font-medium ${comment.resolved ? "text-gray-500" : "text-gray-900"}`}>
            {comment.authorName}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
      </div>

      <p className={`mb-2 text-sm ${comment.resolved ? "text-gray-400" : "text-gray-600"}`}>
        {comment.content}
      </p>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className={`mb-2 pl-3 border-l-2 space-y-2 ${comment.resolved ? "border-gray-200" : "border-amber-200"}`}>
          {comment.replies.map((reply) => (
            <div key={reply.id} className="text-xs">
              <span className={`font-medium ${comment.resolved ? "text-gray-400" : "text-gray-700"}`}>
                {reply.author}
              </span>
              <span className="ml-1.5 text-gray-400">{formatTimestamp(reply.createdAt)}</span>
              <p className={`mt-0.5 ${comment.resolved ? "text-gray-400" : "text-gray-600"}`}>{reply.text}</p>
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
              <span className="text-xs text-amber-600 font-medium">Content deleted</span>
            )}
            <div className={`flex items-center gap-3 ${!isContentDeleted ? "ml-auto" : ""}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReplyInput((v) => !v);
                  setReplyText("");
                }}
                className="text-xs font-medium text-gray-400 hover:text-[#B8692A] transition-colors"
              >
                Reply
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(comment.id);
                }}
                className="text-xs font-medium text-gray-400 hover:text-green-600 transition-colors"
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
                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-[#B8692A]"
              />
              <div className="flex justify-end gap-2 mt-1.5">
                <button
                  onClick={() => { setShowReplyInput(false); setReplyText(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
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
                  className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-2.5 py-1 rounded-md"
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

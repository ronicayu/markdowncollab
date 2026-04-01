"use client";

import type { Comment } from "@/types";

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
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

export default function CommentCard({ comment, onClick }: CommentCardProps) {
  if (comment.resolved) {
    return null;
  }

  const isAgent = comment.authorType === "agent";

  return (
    <div
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onClick(comment.id)}
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
          <span className="text-sm font-medium text-gray-900">
            {comment.authorName}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {formatTimestamp(comment.createdAt)}
          </span>
        </div>
      </div>

      <p className="mb-3 text-sm text-gray-600">{comment.content}</p>

      <div className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-400">
        Reply...
      </div>
    </div>
  );
}

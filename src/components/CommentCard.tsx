"use client";

import { useEffect, useRef } from "react";
import type { Comment } from "@/types";

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
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
  isActive,
  isContentDeleted,
}: CommentCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

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

      {comment.resolved ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Resolved
        </span>
      ) : (
        <div className="flex items-center justify-between">
          {isContentDeleted && (
            <span className="text-xs text-amber-600 font-medium">Content deleted</span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(comment.id);
            }}
            className={`text-xs font-medium text-gray-400 hover:text-green-600 transition-colors ${isContentDeleted ? "" : "ml-auto"}`}
          >
            Resolve
          </button>
        </div>
      )}
    </div>
  );
}

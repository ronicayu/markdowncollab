"use client";

import { useEffect, useRef } from "react";
import type { RevisionRequest } from "@/types";

interface RevisionRequestCardProps {
  request: RevisionRequest;
  onClick: (id: string) => void;
  onResolve: (id: string) => void;
  isActive?: boolean;
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
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function RevisionRequestCard({
  request,
  onClick,
  onResolve,
  isActive,
}: RevisionRequestCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive]);

  const isResolved = request.status === "resolved";

  const cardClass = isResolved
    ? "rounded-lg border border-[rgba(0,0,0,0.1)] bg-[#f6f5f4] p-3 shadow-sm opacity-60"
    : isActive
    ? "cursor-pointer rounded-lg border border-[#dd5b00] bg-[#fbece0] p-3 ring-2 ring-[rgba(221,91,0,0.4)] shadow-sm transition-all hover:shadow-md"
    : "cursor-pointer rounded-lg border border-[rgba(221,91,0,0.3)] bg-white p-3 shadow-sm transition-all hover:shadow-md";

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => !isResolved && onClick(request.id)}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white bg-[#dd5b00]">
          {getInitials(request.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium ${
              isResolved ? "text-[#615d59]" : "text-[#31302e]"
            }`}
          >
            {request.authorName}
          </span>
          <span className="ml-2 text-xs text-[#a39e98]">
            {formatTimestamp(request.createdAt)}
          </span>
        </div>
        {/* Status badge */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isResolved
              ? "bg-green-100 text-green-700"
              : "bg-[#fbece0] text-[#dd5b00]"
          }`}
        >
          {isResolved ? "Resolved" : "Open"}
        </span>
      </div>

      {/* Content */}
      <p
        className={`mb-2 text-sm ${
          isResolved ? "text-[#a39e98]" : "text-[#615d59]"
        }`}
      >
        {request.content}
      </p>

      {/* Assignee */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs text-[#a39e98]">Assigned to:</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isResolved
              ? "bg-[#f6f5f4] text-[#615d59]"
              : "bg-blue-50 text-blue-700"
          }`}
        >
          {request.assignee}
        </span>
      </div>

      {/* Actions */}
      {!isResolved && (
        <div className="flex items-center justify-end">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(request.id);
            }}
            className="text-xs font-medium text-[#a39e98] hover:text-green-600 transition-colors"
          >
            Resolve
          </button>
        </div>
      )}

      {isResolved && (
        <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
          Resolved
        </span>
      )}
    </div>
  );
}

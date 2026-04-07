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
    ? "rounded-lg border border-gray-200 bg-gray-50 p-3 shadow-sm opacity-60"
    : isActive
    ? "cursor-pointer rounded-lg border border-orange-400 bg-orange-50 p-3 ring-2 ring-orange-300 shadow-sm transition-all hover:shadow-md"
    : "cursor-pointer rounded-lg border border-orange-200 bg-white p-3 shadow-sm transition-all hover:shadow-md";

  return (
    <div
      ref={cardRef}
      className={cardClass}
      onClick={() => !isResolved && onClick(request.id)}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white bg-orange-600">
          {getInitials(request.authorName)}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm font-medium ${
              isResolved ? "text-gray-500" : "text-gray-900"
            }`}
          >
            {request.authorName}
          </span>
          <span className="ml-2 text-xs text-gray-400">
            {formatTimestamp(request.createdAt)}
          </span>
        </div>
        {/* Status badge */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isResolved
              ? "bg-green-100 text-green-700"
              : "bg-orange-100 text-orange-700"
          }`}
        >
          {isResolved ? "Resolved" : "Open"}
        </span>
      </div>

      {/* Content */}
      <p
        className={`mb-2 text-sm ${
          isResolved ? "text-gray-400" : "text-gray-600"
        }`}
      >
        {request.content}
      </p>

      {/* Assignee */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs text-gray-400">Assigned to:</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isResolved
              ? "bg-gray-100 text-gray-500"
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
            className="text-xs font-medium text-gray-400 hover:text-green-600 transition-colors"
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

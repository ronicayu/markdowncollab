"use client";

import type { Suggestion } from "@/types";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onClick,
}: SuggestionCardProps) {
  if (suggestion.status !== "pending" && suggestion.status !== "stale") {
    return null;
  }

  const isAgent = suggestion.authorType === "agent";

  return (
    <div
      className="cursor-pointer rounded-lg border border-[rgba(0,0,0,0.1)] bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onClick(suggestion.id)}
    >
      <div className="mb-2 flex items-center gap-2">
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold text-white ${
            isAgent ? "bg-[#31302e]" : "bg-[#f6f5f4]0"
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
            getInitials(suggestion.authorName)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-[#31302e]">
            {suggestion.authorName}
          </span>
          <span className="ml-2 text-xs text-[#a39e98]">
            {formatTimestamp(suggestion.createdAt)}
          </span>
        </div>
      </div>

      <p className="mb-3 text-sm text-[#615d59]">{suggestion.rationale}</p>

      {suggestion.status === "stale" ? (
        <div className="rounded-md bg-[#fbece0] px-3 py-2 text-xs text-[#dd5b00]">
          Content changed — re-run?
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept(suggestion.id);
            }}
            className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            Accept
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject(suggestion.id);
            }}
            className="rounded-md border border-[#dddddd] px-3 py-1 text-xs font-medium text-[#31302e] transition-colors hover:bg-[#f6f5f4]"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

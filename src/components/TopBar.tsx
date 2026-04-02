"use client";

import { useState, useEffect } from "react";

export interface Collaborator {
  name: string;
  color: string;
  isAgent?: boolean;
}

interface TopBarProps {
  title: string;
  documentId: string;
  collaborators: Collaborator[];
  onInviteAgent: () => void;
  onTitleChange?: (title: string) => void;
  agentLoading?: boolean;
}

export default function TopBar({
  title,
  documentId,
  collaborators,
  onInviteAgent,
  onTitleChange,
  agentLoading,
}: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const [editableTitle, setEditableTitle] = useState(title);

  const [showShareModal, setShowShareModal] = useState(false);

  // Sync editableTitle when title prop changes (e.g. after fetch)
  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  function commitTitle() {
    const trimmed = editableTitle.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setEditableTitle(title);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/doc/${documentId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API fails on non-HTTPS — show modal with selectable URL
      setShowShareModal(true);
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2 md:px-4">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <a href="/" className="font-mono text-sm md:text-lg font-bold text-gray-900 shrink-0 hover:text-gray-600">
          MC
        </a>
        <span className="hidden sm:inline text-sm text-gray-500">/</span>
        <input
          value={editableTitle}
          onChange={(e) => setEditableTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="hidden sm:inline text-sm font-bold text-gray-700 truncate max-w-[150px] md:max-w-none bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-300 focus:bg-white rounded px-1 -ml-1"
        />
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 shrink-0">
          Editing
        </span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Live collaborators */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-2">
            {collaborators.map((collaborator, index) => (
              <div
                key={index}
                className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
                style={{ backgroundColor: collaborator.color }}
                title={collaborator.name}
              >
                {collaborator.isAgent ? (
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
                  collaborator.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)
                )}
              </div>
            ))}
          </div>
        )}

        {/* Share button */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 h-8 px-2.5 md:px-3 border border-gray-200 text-gray-700 text-xs md:text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
          {copied ? "Copied!" : "Share"}
        </button>

        {/* Share modal fallback for non-HTTPS */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowShareModal(false)}>
            <div className="bg-white rounded-lg shadow-lg p-5 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Share this document</h3>
              <p className="text-xs text-gray-500 mb-3">Copy the link below and send it to your collaborators:</p>
              <input
                readOnly
                value={`${typeof window !== "undefined" ? window.location.origin : ""}/doc/${documentId}`}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-gray-50 select-all"
                onFocus={(e) => e.target.select()}
              />
              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export */}
        <a
          href={`/api/documents/${documentId}/export`}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
        >
          Export .md
        </a>

        {/* Invite Agent */}
        <button
          onClick={onInviteAgent}
          disabled={agentLoading}
          className="rounded-md bg-gray-700 px-2.5 py-1.5 text-xs md:text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {agentLoading && (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {agentLoading ? "Working..." : "Invite Agent"}
        </button>
      </div>
    </div>
  );
}

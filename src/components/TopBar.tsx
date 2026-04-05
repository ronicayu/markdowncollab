"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

export interface Collaborator {
  name: string;
  color: string;
  isAgent?: boolean;
}

interface TopBarProps {
  title: string;
  documentId: string;
  collaborators: Collaborator[];
  connected: boolean;
  onInviteAgent: () => void;
  onTitleChange?: (title: string) => void;
  agentLoading?: boolean;
}

export default function TopBar({
  title,
  documentId,
  collaborators,
  connected,
  onInviteAgent,
  onTitleChange,
  agentLoading,
}: TopBarProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/doc/${documentId}`);
  useEffect(() => {
    setShareUrl(`${window.location.origin}/doc/${documentId}`);
  }, [documentId]);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showShareModal, setShowShareModal] = useState(false);

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
      setShowShareModal(true);
    }
  }

  return (
    <div className="flex items-center justify-between bg-[#111110] px-3 py-2 md:px-4 shrink-0">
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <a
          href="/"
          className="inline-flex items-center h-9 px-1 text-sm font-bold text-white/80 hover:text-white shrink-0 transition-colors"
        >
          MC
        </a>
        <span className="hidden sm:inline text-white/25 text-sm">/</span>
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
          className="hidden sm:inline h-9 text-sm font-semibold text-white/80 truncate max-w-[150px] md:max-w-none bg-transparent border-none outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/5 rounded px-1 -ml-1 transition-colors placeholder:text-white/30"
        />
        {/* Connected status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
              connected ? "bg-[#0D9488]" : "bg-yellow-400"
            }`}
          />
          <span className="hidden md:inline text-xs text-white/40">
            {connected ? "Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Right: collaborators + actions */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* Collaborator avatars */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-2">
            {collaborators.slice(0, 4).map((collaborator, index) => (
              <div
                key={index}
                className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border-2 border-[#111110] text-xs font-semibold text-white"
                style={{ backgroundColor: collaborator.color }}
                title={collaborator.name}
              >
                {collaborator.isAgent ? (
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082" />
                  </svg>
                ) : (
                  collaborator.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                )}
              </div>
            ))}
          </div>
        )}

        {/* Export — ghost */}
        <a
          href={`/api/documents/${documentId}/export`}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
        >
          Export
        </a>

        {/* Invite Agent — ghost */}
        <button
          onClick={onInviteAgent}
          disabled={agentLoading}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {agentLoading ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {agentLoading ? "Working..." : "Invite Agent"}
        </button>

        {/* Auth */}
        {session ? (
          <div className="hidden sm:flex items-center gap-2">
            {session.user?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? ""}
                className="h-6 w-6 rounded-full"
              />
            )}
            <button
              onClick={() => signOut()}
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="hidden sm:flex items-center gap-1.5 h-8 px-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium rounded-md transition-colors"
          >
            Sign in
          </button>
        )}

        {/* Share — primary teal */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 h-8 px-3 bg-[#B8692A] hover:bg-[#96541F] text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
          {copied ? "Copied!" : "Share"}
        </button>
      </div>

      {/* Share modal fallback */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowShareModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Share this document</h3>
            <p className="text-xs text-gray-500 mb-3">Copy the link and send it to your collaborators:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50 select-all"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    // clipboard not available
                  }
                }}
                className="shrink-0 text-sm font-medium bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setShowShareModal(false)} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

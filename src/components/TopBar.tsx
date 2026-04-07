"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ShareDialog from "@/components/ShareDialog";
import { useTheme } from "@/lib/theme";

function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const label =
    theme === "light" ? "Switch to dark mode" : theme === "dark" ? "Switch to system theme" : "Switch to light mode";
  return (
    <button
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/8 transition-colors"
    >
      {resolvedTheme === "dark" ? (
        /* Moon icon */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0112.003 21c-5.385 0-9.75-4.365-9.75-9.75 0-4.126 2.562-7.652 6.178-9.084A9.004 9.004 0 0021.752 15.002z" />
        </svg>
      ) : (
        /* Sun icon */
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.219 4.219l1.061 1.061M17.72 17.72l1.06 1.06M3 12h1.5M19.5 12H21M4.219 19.781l1.061-1.061M17.72 6.28l1.06-1.06" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )}
    </button>
  );
}

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
  userRole?: "owner" | "editor" | "viewer" | null;
  onToggleVersionHistory?: () => void;
  versionHistoryOpen?: boolean;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  onSaveAsTemplate?: () => void;
}

export default function TopBar({
  title,
  documentId,
  collaborators,
  connected,
  onInviteAgent,
  onTitleChange,
  agentLoading,
  userRole,
  onToggleVersionHistory,
  versionHistoryOpen,
  focusMode,
  onToggleFocusMode,
  onSaveAsTemplate,
}: TopBarProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/doc/${documentId}`);
  useEffect(() => {
    setShareUrl(`${window.location.origin}/doc/${documentId}`);
  }, [documentId]);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setEditableTitle(title);
  }, [title]);

  useEffect(() => {
    if (!exportOpen) return;
    function handleClick() {
      setExportOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [exportOpen]);

  function commitTitle() {
    const trimmed = editableTitle.trim();
    if (trimmed && trimmed !== title && onTitleChange) {
      onTitleChange(trimmed);
    } else {
      setEditableTitle(title);
    }
  }

  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  async function handleShare() {
    if (userRole === "owner") {
      setShareDialogOpen(true);
    } else {
      // Non-owners: just copy the URL
      const url = `${window.location.origin}/doc/${documentId}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setShowShareModal(true);
      }
    }
  }

  if (focusMode) {
    return (
      <div className="flex items-center justify-between bg-[#111110] px-3 py-2 md:px-4 shrink-0 transition-all">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="text-sm font-semibold text-white/80 truncate">{title}</span>
        </div>
        <button
          onClick={onToggleFocusMode}
          className="flex items-center gap-1.5 h-8 px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit Focus
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-[#111110] px-3 py-2 md:px-4 shrink-0">
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <a
          href="/"
          aria-label="Go to document list"
          className="inline-flex items-center h-9 px-1 text-sm font-bold text-white/80 hover:text-white shrink-0 transition-colors"
        >
          MC
        </a>
        <span className="text-white/25 text-sm">/</span>
        <input
          aria-label="Document title"
          value={editableTitle}
          onChange={(e) => setEditableTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="h-9 text-sm font-semibold text-white/80 truncate max-w-[100px] sm:max-w-[150px] md:max-w-none bg-transparent border-none outline-none focus:ring-1 focus:ring-white/20 focus:bg-white/5 rounded px-1 -ml-1 transition-colors placeholder:text-white/30 min-w-0"
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
        {userRole === "viewer" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            View only
          </span>
        )}
      </div>

      {/* Right: collaborators + actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
        {/* Theme toggle */}
        <ThemeToggle />
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

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
            title="Export"
            aria-label="Export document"
            aria-expanded={exportOpen}
          >
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="hidden sm:inline">Export</span>
            <svg className="hidden sm:block h-3 w-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a19] border border-white/10 rounded-lg shadow-xl z-50 py-1">
              <a
                href={`/api/documents/${documentId}/export`}
                onClick={() => setExportOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
              >
                <span>Markdown (.md)</span>
              </a>
              <a
                href={`/api/documents/${documentId}/export/pdf`}
                onClick={() => setExportOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors"
              >
                <span>PDF (.pdf)</span>
              </a>
              {onSaveAsTemplate && (
                <>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={() => {
                      setExportOpen(false);
                      onSaveAsTemplate();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <span>Save as template</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Focus mode toggle */}
        <button
          onClick={onToggleFocusMode}
          className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
          title="Focus mode (Cmd+Shift+F)"
          aria-label="Toggle focus mode"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Focus</span>
        </button>

        {/* Version History toggle */}
        <button
          onClick={onToggleVersionHistory}
          className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 text-sm font-medium transition-colors rounded-md ${
            versionHistoryOpen
              ? "text-white bg-white/15"
              : "text-white/60 hover:text-white hover:bg-white/8"
          }`}
          title="Version history"
          aria-label="Version history"
          aria-pressed={versionHistoryOpen ? "true" : "false"}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">History</span>
        </button>

        {/* Invite Agent — icon-only on mobile, text on sm+ */}
        <button
          onClick={onInviteAgent}
          disabled={agentLoading}
          className="flex items-center gap-1.5 h-8 px-2 sm:px-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Invite Agent"
          aria-label={agentLoading ? "Agent working" : "Invite AI agent"}
        >
          {agentLoading ? (
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082" />
            </svg>
          )}
          <span className="hidden sm:inline">{agentLoading ? "Working..." : "Invite Agent"}</span>
        </button>

        {/* Auth */}
        {session ? (
          <div className="flex items-center gap-2">
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
              aria-label="Sign out"
              className="text-xs text-white/50 hover:text-white transition-colors"
            >
              <span className="hidden sm:inline">Sign out</span>
              <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-3 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium rounded-md transition-colors"
          >
            <svg className="h-4 w-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
            </svg>
            <span className="hidden sm:inline">Sign in</span>
          </button>
        )}

        {/* Share — primary */}
        <button
          onClick={handleShare}
          aria-label="Share document"
          className="flex items-center gap-1.5 h-8 px-2 sm:px-3 bg-[#B8692A] hover:bg-[#96541F] text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
          <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
        </button>
      </div>

      {/* Share dialog for owners */}
      <ShareDialog
        documentId={documentId}
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
      />

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

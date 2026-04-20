"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ShareDialog from "@/components/ShareDialog";
import { useTranslation, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { toast } from "@/lib/toast";

export interface Collaborator {
  name: string;
  color: string;
  isAgent?: boolean;
}

export interface BreadcrumbSegment {
  id: string;
  name: string;
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
  onPresent?: () => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
  documentStatus?: string;
  onStatusChange?: (status: string) => void;
  breadcrumbs?: BreadcrumbSegment[];
  onSummarize?: () => void;
  summaryLoading?: boolean;
  onSetExpiration?: () => void;
  autoCompleteEnabled?: boolean;
  onToggleAutoComplete?: () => void;
  forkedFrom?: { id: string; title: string } | null;
  agentTone?: string;
  onAgentToneChange?: (tone: string) => void;
  publishAt?: string | null;
  onSchedulePublish?: (dateTime: string | null) => void;
  onShowMetadata?: () => void;
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
  onPresent,
  onToggleChat,
  chatOpen,
  documentStatus,
  onStatusChange,
  breadcrumbs,
  onSummarize,
  summaryLoading,
  onSetExpiration,
  autoCompleteEnabled,
  onToggleAutoComplete,
  forkedFrom,
  agentTone,
  onAgentToneChange,
  publishAt,
  onSchedulePublish,
  onShowMetadata,
}: TopBarProps) {
  const { data: session } = useSession();
  const { t, locale, setLocale } = useTranslation();
  const [langOpen, setLangOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState(`/doc/${documentId}`);
  useEffect(() => {
    setShareUrl(`${window.location.origin}/doc/${documentId}`);
  }, [documentId]);
  const [editableTitle, setEditableTitle] = useState(title);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [preferredExportFormat, setPreferredExportFormat] = useState<string>("markdown");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [embedCodeOpen, setEmbedCodeOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleValue, setScheduleValue] = useState("");

  // Load preferred export format from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("preferredExportFormat");
      if (saved) setPreferredExportFormat(saved);
    } catch {}
  }, []);

  const saveExportFormat = (format: string) => {
    setPreferredExportFormat(format);
    try { localStorage.setItem("preferredExportFormat", format); } catch {}
  };

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
      <div data-topbar className="flex items-center justify-between px-3 py-2 md:px-4 shrink-0 transition-all" style={{ background: "var(--surface)", borderBottom: "1px solid var(--rule)" }}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</span>
        </div>
        <button
          onClick={onToggleFocusMode}
          className="flex items-center gap-1.5 h-8 px-3 rounded-md transition-colors"
          style={{ fontSize: 15, fontWeight: 500, color: "var(--ink-soft)" }}
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
    <div data-topbar className="flex items-center justify-between px-3 py-2 md:px-4 shrink-0" style={{ background: "var(--surface)", borderBottom: "1px solid var(--rule)" }}>
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <a
          href="/"
          aria-label="Back to all documents"
          className="inline-flex items-center gap-1.5 h-9 px-1 shrink-0 transition-colors hover:opacity-70"
          style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-soft)" }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">All documents</span>
        </a>
        <span className="hidden md:inline-block h-4 w-px shrink-0" style={{ background: "var(--rule)" }} />
        {breadcrumbs && breadcrumbs.length > 0 && (
          <>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.id} className="flex items-center gap-2">
                {i > 0 && <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>/</span>}
                <a
                  href={`/?folder=${crumb.id}`}
                  className="truncate max-w-[80px] transition-colors hover:opacity-70"
                  style={{ fontSize: 13, color: "var(--ink-soft)" }}
                  title={crumb.name}
                >
                  {crumb.name}
                </a>
              </span>
            ))}
            <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>/</span>
          </>
        )}
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
          className="h-9 truncate max-w-[100px] sm:max-w-[150px] md:max-w-none bg-transparent border-none outline-none rounded px-1 -ml-1 transition-colors min-w-0"
          style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}
        />
        {/* Connected status — dot + muted "saved" caption */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full transition-colors"
            style={{ background: connected ? "var(--ok)" : "var(--warn)" }}
          />
          <span className="hidden md:inline" style={{ fontSize: 13, color: "var(--ink-muted)" }}>
            {connected ? t("status.connected") : t("status.connecting")}
          </span>
        </div>
        {userRole === "viewer" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{ fontSize: 12, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent-on-soft)" }}>
            View only
          </span>
        )}
        {documentStatus && documentStatus !== "draft" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full" style={{
            fontSize: 12,
            fontWeight: 600,
            background: documentStatus === "approved" ? "var(--ok-soft)" : "var(--warn-soft)",
            color: documentStatus === "approved" ? "var(--ok)" : "var(--warn)",
          }}>
            {documentStatus === "approved" ? "Approved" : "In Review"}
          </span>
        )}
        {forkedFrom && (
          <a
            href={`/doc/${forkedFrom.id}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full transition-colors"
            style={{ fontSize: 12, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent-on-soft)" }}
            title={`Forked from: ${forkedFrom.title}`}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
            Forked from: {forkedFrom.title}
          </a>
        )}
      </div>

      {/* Mobile hamburger menu button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="md:hidden flex items-center justify-center h-9 w-9 rounded-md transition-colors shrink-0"
        style={{ color: "var(--ink-soft)" }}
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Slide-out menu (shared: mobile hamburger + desktop ⋯ overflow) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 mobile-menu-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel — rendered as a clean white drawer matching DESIGN.md chrome */}
          <div
            className="absolute top-0 right-0 bottom-0 w-[300px] overflow-y-auto mobile-menu-panel"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--rule)", boxShadow: "var(--shadow-deep)", paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--rule)" }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Menu</span>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="h-9 w-9 flex items-center justify-center rounded-md transition-colors"
                style={{ color: "var(--ink-soft)" }}
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Document section */}
            <div className="px-2 py-2">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>Document</p>
              <button
                onClick={() => { setExportOpen(false); setMobileMenuOpen(false); }}
                className="mobile-menu-item"
              >
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                <span>Export</span>
              </button>
              {/* Export sub-options */}
              <a href={`/api/documents/${documentId}/export`} onClick={() => { setMobileMenuOpen(false); saveExportFormat("markdown"); }} className="mobile-menu-item pl-11">
                Markdown (.md)
              </a>
              <a href={`/api/documents/${documentId}/export/pdf`} onClick={() => { setMobileMenuOpen(false); saveExportFormat("pdf"); }} className="mobile-menu-item pl-11">
                PDF (.pdf)
              </a>
              <a href={`/api/documents/${documentId}/export/docx`} onClick={() => { setMobileMenuOpen(false); saveExportFormat("docx"); }} className="mobile-menu-item pl-11">
                Word (.docx)
              </a>
              <a href={`/api/documents/${documentId}/export/html`} onClick={() => { setMobileMenuOpen(false); saveExportFormat("html"); }} className="mobile-menu-item pl-11">
                HTML (.html)
              </a>
              {onPresent && (
                <button onClick={() => { onPresent(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  <span>Present</span>
                </button>
              )}
              {onSaveAsTemplate && (
                <button onClick={() => { onSaveAsTemplate(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>Duplicate as Template</span>
                </button>
              )}
              {onSetExpiration && (
                <button onClick={() => { onSetExpiration(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                  <span>Set Expiration</span>
                </button>
              )}
            </div>

            {/* AI section */}
            <div className="px-2 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>AI</p>
              <button onClick={() => { onInviteAgent(); setMobileMenuOpen(false); }} disabled={agentLoading} className="mobile-menu-item">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082" />
                </svg>
                <span>{agentLoading ? "Agent Working..." : "Invite Agent"}</span>
              </button>
              {onSummarize && (
                <button onClick={() => { onSummarize(); setMobileMenuOpen(false); }} disabled={summaryLoading} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span>{summaryLoading ? "Summarizing..." : "AI Summary"}</span>
                </button>
              )}
              {onToggleAutoComplete && (
                <button onClick={() => { onToggleAutoComplete(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span>Auto-Complete {autoCompleteEnabled ? "(On)" : "(Off)"}</span>
                </button>
              )}
              {onToggleChat && (
                <button onClick={() => { onToggleChat(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <span>AI Chat {chatOpen ? "(Open)" : ""}</span>
                </button>
              )}
            </div>

            {/* Collaboration section */}
            <div className="px-2 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>Collaboration</p>
              <button onClick={() => { handleShare(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
                </svg>
                <span>Share</span>
              </button>
              <button onClick={() => { onToggleVersionHistory?.(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>History {versionHistoryOpen ? "(Open)" : ""}</span>
              </button>
            </div>

            {/* View section */}
            <div className="px-2 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>View</p>
              <div className="mobile-menu-item">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <span>Language</span>
              </div>
              <div className="pl-11 flex flex-col">
                {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setLocale(loc); setMobileMenuOpen(false); }}
                    className="text-left px-3 py-2 text-sm rounded transition-colors"
                    style={{
                      color: locale === loc ? "var(--ink)" : "var(--ink-soft)",
                      background: locale === loc ? "var(--surface-2)" : "transparent",
                      fontWeight: locale === loc ? 600 : 400,
                    }}
                  >
                    {LOCALE_LABELS[loc]}
                  </button>
                ))}
              </div>
              <button onClick={() => { onToggleFocusMode?.(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Focus Mode</span>
              </button>
            </div>

            {/* Auth section */}
            <div className="px-2 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>Account</p>
              {session ? (
                <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span>Sign out ({session.user?.name || "User"})</span>
                </button>
              ) : (
                <button onClick={() => { signIn(); setMobileMenuOpen(false); }} className="mobile-menu-item">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                  <span>Sign in</span>
                </button>
              )}
            </div>

            {/* Status change for owner on mobile */}
            {userRole === "owner" && onStatusChange && (
              <div className="px-2 py-2" style={{ borderTop: "1px solid var(--rule)" }}>
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-muted)" }}>Status</p>
                {documentStatus === "draft" && (
                  <button onClick={() => { onStatusChange("in_review"); setMobileMenuOpen(false); }} className="mobile-menu-item" style={{ color: "var(--warn)" }}>
                    <span>Submit for Review</span>
                  </button>
                )}
                {documentStatus === "in_review" && (
                  <>
                    <button onClick={() => { onStatusChange("approved"); setMobileMenuOpen(false); }} className="mobile-menu-item" style={{ color: "var(--ok)" }}>
                      <span>Approve</span>
                    </button>
                    <button onClick={() => { onStatusChange("draft"); setMobileMenuOpen(false); }} className="mobile-menu-item">
                      <span>Request Changes</span>
                    </button>
                  </>
                )}
                {documentStatus === "approved" && (
                  <button onClick={() => { onStatusChange("draft"); setMobileMenuOpen(false); }} className="mobile-menu-item">
                    <span>Revert to Draft</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right: collaborators + actions (desktop only) */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        {/* Collaborator avatars — always visible */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-2 mr-1">
            {collaborators.slice(0, 4).map((collaborator, index) => (
              <div
                key={index}
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: collaborator.color, border: "2px solid var(--surface)" }}
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

        {/* Overflow ⋯ menu — opens the same mobile menu panel which contains all secondary actions */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex items-center justify-center h-8 w-8 rounded-md transition-colors"
          style={{ color: "var(--ink-soft)" }}
          title="More actions"
          aria-label="More actions"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
          </svg>
        </button>

        {/* Primary: Share */}
        <button
          onClick={handleShare}
          aria-label="Share document"
          className="flex items-center gap-1.5 h-8 px-3 rounded-md transition-colors"
          style={{ background: "var(--accent)", color: "#fff", fontSize: 14, fontWeight: 600 }}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
          </svg>
          <span>{copied ? "Copied!" : "Share"}</span>
        </button>
      </div>

      {/* Hidden legacy desktop cluster — actions remain mounted but invisible; users reach them via the overflow ⋯ menu */}
      <div className="hidden" aria-hidden="true">
        {/* Document info */}
        {onShowMetadata && (
          <button
            onClick={onShowMetadata}
            className="flex items-center gap-1 h-8 px-2 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
            title="Document info"
            aria-label="Document info"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </button>
        )}
        {/* Language selector */}
        <div className="relative">
          <button
            onClick={() => setLangOpen((v) => !v)}
            className="flex items-center gap-1 h-8 px-2 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
            title={t("language")}
            aria-label={t("language")}
            aria-expanded={langOpen}
            aria-haspopup="true"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </button>
          {langOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-[#ffffff] border border-[rgba(0,0,0,0.1)] rounded-lg shadow-[var(--shadow-deep)] z-50 py-1">
              {(Object.keys(LOCALE_LABELS) as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => { setLocale(loc); setLangOpen(false); }}
                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm transition-colors ${
                    locale === loc ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/8"
                  }`}
                >
                  {LOCALE_LABELS[loc]}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Collaborator avatars */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-2">
            {collaborators.slice(0, 4).map((collaborator, index) => (
              <div
                key={index}
                className="flex h-6 w-6 md:h-7 md:w-7 items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-[#31302e] text-xs font-semibold text-white"
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

        {/* Schedule Publish */}
        {onSchedulePublish && (
          <div className="relative">
            <button
              onClick={() => {
                setScheduleOpen((v) => !v);
                if (publishAt) {
                  setScheduleValue(publishAt.slice(0, 16));
                } else {
                  // Default to tomorrow at noon
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  d.setHours(12, 0, 0, 0);
                  setScheduleValue(d.toISOString().slice(0, 16));
                }
              }}
              className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 text-sm font-medium transition-colors rounded-md ${
                publishAt
                  ? "text-green-400 bg-green-400/10 hover:bg-green-400/20"
                  : "text-white/60 hover:text-white hover:bg-white/8"
              }`}
              title={publishAt ? `Scheduled: ${new Date(publishAt).toLocaleString()}` : "Schedule publish"}
              aria-label="Schedule publish"
              aria-expanded={scheduleOpen}
              aria-haspopup="true"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <span className="hidden sm:inline">{publishAt ? "Scheduled" : "Schedule"}</span>
            </button>
            {scheduleOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[#ffffff] border border-[rgba(0,0,0,0.1)] rounded-lg shadow-[var(--shadow-deep)] z-50 p-3">
                <p className="text-xs font-medium text-white/70 mb-2">Schedule publish date/time</p>
                <input
                  type="datetime-local"
                  value={scheduleValue}
                  onChange={(e) => setScheduleValue(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-[#0075de]"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      if (scheduleValue) {
                        onSchedulePublish(new Date(scheduleValue).toISOString());
                      }
                      setScheduleOpen(false);
                    }}
                    className="flex-1 text-xs font-medium bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Set schedule
                  </button>
                  {publishAt && (
                    <button
                      onClick={() => {
                        onSchedulePublish(null);
                        setScheduleOpen(false);
                      }}
                      className="text-xs font-medium text-red-400 hover:text-red-300 px-2 py-1.5"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summarize button */}
        {onSummarize && (
          <button
            onClick={onSummarize}
            disabled={summaryLoading}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate AI summary"
            aria-label="Generate AI summary"
          >
            {summaryLoading ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            )}
            <span className="hidden sm:inline">{summaryLoading ? "Summarizing..." : "Summarize"}</span>
          </button>
        )}

        {/* Present button */}
        {onPresent && (
          <button
            onClick={onPresent}
            className="flex items-center gap-1.5 h-8 px-2 sm:px-3 text-white/60 hover:text-white text-sm font-medium transition-colors rounded-md hover:bg-white/8"
            title="Present as slides"
            aria-label="Present as slides"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
            <span className="hidden sm:inline">Present</span>
          </button>
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
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#ffffff] border border-[rgba(0,0,0,0.1)] rounded-lg shadow-[var(--shadow-deep)] z-50 py-1">
              {[
                { key: "markdown", label: "Markdown (.md)", href: `/api/documents/${documentId}/export` },
                { key: "pdf", label: "PDF (.pdf)", href: `/api/documents/${documentId}/export/pdf` },
                { key: "docx", label: "Word (.docx)", href: `/api/documents/${documentId}/export/docx` },
                { key: "html", label: "HTML (.html)", href: `/api/documents/${documentId}/export/html` },
              ]
                .sort((a, b) => (a.key === preferredExportFormat ? -1 : b.key === preferredExportFormat ? 1 : 0))
                .map((fmt) => (
                <a
                  key={fmt.key}
                  href={fmt.href}
                  onClick={() => { setExportOpen(false); saveExportFormat(fmt.key); }}
                  className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    fmt.key === preferredExportFormat
                      ? "text-white font-medium bg-white/5"
                      : "text-white/70 hover:text-white hover:bg-white/8"
                  }`}
                >
                  <span>{fmt.label}</span>
                </a>
              ))}
              <button
                onClick={async () => {
                  setExportOpen(false);
                  try {
                    const res = await fetch(`/api/documents/${documentId}/export`);
                    if (!res.ok) throw new Error("Export failed");
                    const md = await res.text();
                    await navigator.clipboard.writeText(md);
                    // Show a brief toast-like notification
                    const toast = document.createElement("div");
                    toast.textContent = "Copied to clipboard";
                    toast.style.cssText = "position:fixed;bottom:24px;right:24px;background:#111;color:#fff;padding:8px 16px;border-radius:8px;font-size:13px;z-index:99999;opacity:0;transition:opacity 0.2s";
                    document.body.appendChild(toast);
                    requestAnimationFrame(() => { toast.style.opacity = "1"; });
                    setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 200); }, 2000);
                  } catch (err) {
                    console.error("Copy as markdown failed:", err);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                <span>Copy as Markdown</span>
              </button>
              <button
                onClick={async () => {
                  setExportOpen(false);
                  try {
                    const { toPng } = await import("html-to-image");
                    const el = document.querySelector(".ProseMirror") as HTMLElement;
                    if (!el) return;
                    const dataUrl = await toPng(el, { backgroundColor: "#ffffff", pixelRatio: 2 });
                    const link = document.createElement("a");
                    link.download = `${title || "document"}.png`;
                    link.href = dataUrl;
                    link.click();
                  } catch (err) {
                    console.error("Copy as image failed:", err);
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Copy as image (.png)</span>
              </button>
              <div className="border-t border-white/10 my-1" />
              <button
                onClick={() => {
                  setExportOpen(false);
                  setEmbedCodeOpen(true);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <span>Get embed code</span>
              </button>
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
              {onSetExpiration && (
                <>
                  <div className="border-t border-white/10 my-1" />
                  <button
                    onClick={() => {
                      setExportOpen(false);
                      onSetExpiration();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/8 transition-colors w-full text-left"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                    <span>Set expiration</span>
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
          <span className="hidden sm:inline">{t("topbar.focus")}</span>
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
          <span className="hidden sm:inline">{t("topbar.history")}</span>
        </button>

        {/* Auto-complete toggle */}
        {onToggleAutoComplete && (
          <button
            onClick={onToggleAutoComplete}
            className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 text-sm font-medium transition-colors rounded-md ${
              autoCompleteEnabled
                ? "text-white bg-white/15"
                : "text-white/60 hover:text-white hover:bg-white/8"
            }`}
            title="Toggle AI auto-complete"
            aria-label="Toggle AI auto-complete"
            aria-pressed={autoCompleteEnabled ? "true" : "false"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            <span className="hidden sm:inline">Auto-complete</span>
          </button>
        )}

        {/* AI Chat toggle */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={`flex items-center gap-1.5 h-8 px-2 sm:px-3 text-sm font-medium transition-colors rounded-md ${
              chatOpen
                ? "text-white bg-white/15"
                : "text-white/60 hover:text-white hover:bg-white/8"
            }`}
            title="AI Chat"
            aria-label="Toggle AI chat"
            aria-pressed={chatOpen ? "true" : "false"}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <span className="hidden sm:inline">{t("topbar.chat")}</span>
          </button>
        )}

        {/* Agent Tone Selector */}
        {onAgentToneChange && (
          <select
            value={agentTone || ""}
            onChange={(e) => onAgentToneChange(e.target.value)}
            className="h-8 px-2 text-xs font-medium text-white/60 bg-transparent border border-white/15 rounded-md hover:border-white/30 focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
            title="AI writing tone"
            aria-label="Select AI writing tone"
          >
            <option value="" className="bg-[#ffffff] text-[#31302e]">Default tone</option>
            <option value="formal" className="bg-[#ffffff] text-[#31302e]">Formal</option>
            <option value="casual" className="bg-[#ffffff] text-[#31302e]">Casual</option>
            <option value="technical" className="bg-[#ffffff] text-[#31302e]">Technical</option>
            <option value="friendly" className="bg-[#ffffff] text-[#31302e]">Friendly</option>
          </select>
        )}

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
          <span className="hidden sm:inline">{agentLoading ? "Working..." : t("topbar.inviteAgent")}</span>
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

        {/* Status change buttons (owner only) */}
        {userRole === "owner" && onStatusChange && documentStatus === "draft" && (
          <button
            onClick={() => onStatusChange("in_review")}
            className="flex items-center gap-1 h-8 px-2 sm:px-3 text-[#dd5b00] hover:text-[#dd5b00] border border-[#dd5b00]/30 hover:border-[#dd5b00]/50 text-xs sm:text-sm font-medium rounded-md transition-colors"
            title="Submit for review"
          >
            <span className="hidden sm:inline">Submit for Review</span>
            <span className="sm:hidden">Review</span>
          </button>
        )}
        {userRole === "owner" && onStatusChange && documentStatus === "in_review" && (
          <>
            <button
              onClick={() => onStatusChange("approved")}
              className="flex items-center gap-1 h-8 px-2 sm:px-3 text-green-400 hover:text-green-300 border border-green-400/30 hover:border-green-400/50 text-xs sm:text-sm font-medium rounded-md transition-colors"
              title="Approve document"
            >
              <span className="hidden sm:inline">Approve</span>
              <span className="sm:hidden">OK</span>
            </button>
            <button
              onClick={() => onStatusChange("draft")}
              className="flex items-center gap-1 h-8 px-2 sm:px-3 text-white/50 hover:text-white/70 border border-white/15 hover:border-white/25 text-xs sm:text-sm font-medium rounded-md transition-colors"
              title="Request changes"
            >
              <span className="hidden sm:inline">Request Changes</span>
              <span className="sm:hidden">Changes</span>
            </button>
          </>
        )}
        {userRole === "owner" && onStatusChange && documentStatus === "approved" && (
          <button
            onClick={() => onStatusChange("draft")}
            className="flex items-center gap-1 h-8 px-2 sm:px-3 text-white/50 hover:text-white/70 border border-white/15 hover:border-white/25 text-xs sm:text-sm font-medium rounded-md transition-colors"
            title="Revert to draft"
          >
            <span className="hidden sm:inline">Revert to Draft</span>
            <span className="sm:hidden">Draft</span>
          </button>
        )}

        {/* Share — primary */}
        <button
          onClick={handleShare}
          aria-label="Share document"
          className="flex items-center gap-1.5 h-8 px-2 sm:px-3 bg-[#0075de] hover:bg-[#005bab] text-white text-sm font-medium rounded-md transition-colors"
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
            <h3 className="text-sm font-semibold text-[#31302e] mb-2">Share this document</h3>
            <p className="text-xs text-[#615d59] mb-3">Copy the link and send it to your collaborators:</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 min-w-0 border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm text-[#31302e] bg-[#f6f5f4] select-all"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                    toast("Link copied to clipboard", "success");
                  } catch {
                    toast("Failed to copy link — try selecting and copying manually", "error");
                  }
                }}
                className="shrink-0 text-sm font-medium bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-2 rounded-lg transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => setShowShareModal(false)} className="text-sm font-medium text-[#615d59] hover:text-[#31302e] px-3 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embed code dialog */}
      {embedCodeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEmbedCodeOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[#31302e] mb-2">Embed this document</h3>
            <p className="text-xs text-[#615d59] mb-3">Copy the code below and paste it into your website:</p>
            <textarea
              readOnly
              value={`<iframe src="${shareUrl.replace('/doc/', '/embed/')}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`}
              className="w-full border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-xs text-[#31302e] bg-[#f6f5f4] font-mono resize-none"
              rows={4}
              onFocus={(e) => e.target.select()}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={async () => {
                  const code = `<iframe src="${shareUrl.replace('/doc/', '/embed/')}" width="100%" height="600" frameborder="0" style="border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`;
                  try { await navigator.clipboard.writeText(code); } catch {}
                  setEmbedCodeOpen(false);
                }}
                className="text-sm font-medium bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-2 rounded-lg transition-colors"
              >
                Copy & Close
              </button>
              <button onClick={() => setEmbedCodeOpen(false)} className="text-sm font-medium text-[#615d59] hover:text-[#31302e] px-3 py-1.5">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

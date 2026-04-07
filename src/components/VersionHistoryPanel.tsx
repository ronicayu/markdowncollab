"use client";

import { useState, useEffect, useCallback } from "react";
import type { DocumentVersion, VersionPreview, VersionListResponse } from "@/types";
import DiffViewer from "./DiffViewer";

interface VersionHistoryPanelProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  onRestoreComplete?: () => void;
  getCurrentMarkdown?: () => string;
}

export default function VersionHistoryPanel({
  documentId,
  isOpen,
  onClose,
  userName,
  onRestoreComplete,
  getCurrentMarkdown,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<VersionPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<DocumentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [diffData, setDiffData] = useState<{ oldText: string; newText: string; oldLabel: string } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions?page=${page}`
      );
      if (res.ok) {
        const data: VersionListResponse = await res.json();
        setVersions(data.versions);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch versions:", err);
    } finally {
      setLoading(false);
    }
  }, [documentId, page]);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, fetchVersions]);

  async function handlePreview(version: DocumentVersion) {
    setPreviewLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${version.id}`
      );
      if (res.ok) {
        const data: VersionPreview = await res.json();
        setPreview(data);
      }
    } catch (err) {
      console.error("Failed to load preview:", err);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleRestore(version: DocumentVersion) {
    setRestoring(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${version.id}/restore`,
        { method: "POST" }
      );
      if (res.ok) {
        setRestoreTarget(null);
        setPreview(null);
        await fetchVersions();
        onRestoreComplete?.();
      }
    } catch (err) {
      console.error("Failed to restore version:", err);
    } finally {
      setRestoring(false);
    }
  }

  async function handleSaveManual() {
    setSavingManual(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createdByName: userName }),
      });
      if (res.ok) {
        await fetchVersions();
      }
    } catch (err) {
      console.error("Failed to save version:", err);
    } finally {
      setSavingManual(false);
    }
  }

  async function handleCompare(version: DocumentVersion) {
    if (!getCurrentMarkdown) return;
    setDiffLoading(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${version.id}`
      );
      if (res.ok) {
        const data: VersionPreview = await res.json();
        const currentMd = getCurrentMarkdown();
        setDiffData({
          oldText: data.markdown,
          newText: currentMd,
          oldLabel: `${formatTime(version.createdAt)} - ${formatDate(version.createdAt)}`,
        });
      }
    } catch (err) {
      console.error("Failed to load version for comparison:", err);
    } finally {
      setDiffLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function typeBadge(type: string) {
    switch (type) {
      case "manual":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#B8692A]/15 text-[#B8692A]">
            Manual
          </span>
        );
      case "restore":
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">
            Restore
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
            Auto
          </span>
        );
    }
  }

  // Group versions by date
  const groupedVersions: { date: string; items: DocumentVersion[] }[] = [];
  let currentDate = "";
  for (const v of versions) {
    const date = formatDate(v.createdAt);
    if (date !== currentDate) {
      currentDate = date;
      groupedVersions.push({ date, items: [v] });
    } else {
      groupedVersions[groupedVersions.length - 1].items.push(v);
    }
  }

  const totalPages = Math.ceil(total / 20);

  if (!isOpen) return null;

  return (
    <>
      <div className="w-80 shrink-0 overflow-y-auto border-l border-[#E8D8C0] bg-[#F5EBD8] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#E8D8C0]">
          <h2 className="text-sm font-semibold text-gray-700">
            Version History
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-[#E8D8C0] transition-colors"
            title="Close version history"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Save version button */}
        <div className="px-3 py-2 border-b border-[#E8D8C0]">
          <button
            onClick={handleSaveManual}
            disabled={savingManual}
            className="w-full flex items-center justify-center gap-1.5 h-8 text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 rounded-md transition-colors"
          >
            {savingManual ? (
              <>
                <svg
                  className="h-3 w-3 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </>
            ) : (
              <>
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
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Save version
              </>
            )}
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg
                className="h-5 w-5 animate-spin text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              No versions yet. Versions are created automatically as you edit, or
              click &quot;Save version&quot; above.
            </p>
          ) : (
            <>
              {groupedVersions.map((group) => (
                <div key={group.date} className="mb-3">
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">
                    {group.date}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map((version) => (
                      <div
                        key={version.id}
                        className="w-full text-left px-2.5 py-2 rounded-md border border-transparent hover:border-[#D4A978] hover:bg-[#FFFEF9] transition-colors group"
                      >
                        <button
                          onClick={() => handlePreview(version)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-700">
                              {formatTime(version.createdAt)}
                            </span>
                            {typeBadge(version.type)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-500 truncate">
                              {version.title}
                            </span>
                          </div>
                          {version.createdByName && (
                            <span className="text-[10px] text-gray-400">
                              by {version.createdByName}
                            </span>
                          )}
                        </button>
                        {getCurrentMarkdown && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompare(version);
                            }}
                            className="mt-1 text-[10px] font-medium text-[#B8692A] hover:text-[#96541F] opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            Compare with current
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-[#E8D8C0]">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-[10px] text-gray-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-xs text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {(preview || previewLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setPreview(null);
            setPreviewLoading(false);
          }}
        >
          <div
            className="bg-[#FFFEF9] rounded-xl shadow-xl mx-4 max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {previewLoading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="h-6 w-6 animate-spin text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : preview ? (
              <>
                {/* Preview header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">
                      {preview.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTime(preview.createdAt)} &middot;{" "}
                      {formatDate(preview.createdAt)}
                      {preview.createdByName &&
                        ` \u00b7 by ${preview.createdByName}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {typeBadge(preview.type)}
                    <button
                      onClick={() => setPreview(null)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Markdown content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono leading-relaxed">
                    {preview.markdown}
                  </pre>
                </div>

                {/* Restore button */}
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => setPreview(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setRestoreTarget(preview);
                      setPreview(null);
                    }}
                    className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] px-4 py-1.5 rounded-md transition-colors"
                  >
                    Restore this version
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Restore confirmation dialog */}
      {restoreTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setRestoreTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-[#B8692A]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Restore this version?
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  This will replace the current document content with the version
                  from {formatTime(restoreTarget.createdAt)},{" "}
                  {formatDate(restoreTarget.createdAt)}.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              A safety snapshot of the current document will be saved
              automatically before restoring.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRestoreTarget(null)}
                disabled={restoring}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(restoreTarget)}
                disabled={restoring}
                className="text-xs font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-4 py-1.5 rounded-md transition-colors"
              >
                {restoring ? "Restoring..." : "Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff comparison modal */}
      {(diffData || diffLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => {
            setDiffData(null);
            setDiffLoading(false);
          }}
        >
          <div
            className="bg-[#FFFEF9] rounded-xl shadow-xl mx-4 max-w-4xl w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {diffLoading ? (
              <div className="flex items-center justify-center py-16">
                <svg
                  className="h-6 w-6 animate-spin text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
              </div>
            ) : diffData ? (
              <>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Version Comparison
                  </h3>
                  <button
                    onClick={() => setDiffData(null)}
                    className="p-1 rounded text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-hidden px-5 py-4">
                  <DiffViewer
                    oldText={diffData.oldText}
                    newText={diffData.newText}
                    oldLabel={diffData.oldLabel}
                    newLabel="Current document"
                  />
                </div>
                <div className="flex items-center justify-end px-5 py-3 border-t border-gray-100">
                  <button
                    onClick={() => setDiffData(null)}
                    className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

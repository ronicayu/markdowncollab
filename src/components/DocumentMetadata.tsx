"use client";

import { useState, useEffect } from "react";
import { estimateReadingTime } from "@/lib/reading-time";

interface DocumentMetadataProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface Analytics {
  viewCount: number;
  editCount: number;
  collaboratorCount: number;
  createdAt: string;
  lastEditedAt: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  userName: string | null;
  createdAt: string;
}

export default function DocumentMetadata({
  documentId,
  isOpen,
  onClose,
}: DocumentMetadataProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [uniqueCollaborators, setUniqueCollaborators] = useState<string[]>([]);
  const [versionCount, setVersionCount] = useState<number>(0);
  const [wordCount, setWordCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setLoading(true);

    Promise.all([
      fetch(`/api/documents/${documentId}/analytics`, { signal: controller.signal }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/documents/${documentId}/activity`, { signal: controller.signal }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/documents/${documentId}/versions`, { signal: controller.signal }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/documents/${documentId}`, { signal: controller.signal }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([analyticsData, activityData, versionsData, docData]) => {
        if (analyticsData) setAnalytics(analyticsData);

        // Extract unique collaborator names from activity log
        if (activityData?.activities) {
          const names = new Set<string>();
          (activityData.activities as ActivityEntry[]).forEach((a) => {
            if (a.userName) names.add(a.userName);
          });
          setUniqueCollaborators(Array.from(names));
        }

        // Version count
        if (versionsData?.total !== undefined) {
          setVersionCount(versionsData.total);
        } else if (versionsData?.versions) {
          setVersionCount(versionsData.versions.length);
        }

        // Estimate word count from document content
        // The document API may return content or we can get it from the editor
        if (docData?.content) {
          const text = docData.content.replace(/<[^>]*>/g, "").trim();
          setWordCount(text ? text.split(/\s+/).length : 0);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch document metadata:", err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [documentId, isOpen]);

  if (!isOpen) return null;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <svg
              className="h-4 w-4 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
            Document Info
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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

        {loading ? (
          <div className="py-8 text-center">
            <p className="text-xs text-gray-400">Loading metadata...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {analytics && (
              <>
                <MetadataRow
                  label="Created"
                  value={formatDate(analytics.createdAt)}
                />
                <MetadataRow
                  label="Last edited"
                  value={formatDate(analytics.lastEditedAt)}
                />
                <MetadataRow
                  label="Views"
                  value={String(analytics.viewCount)}
                />
                <MetadataRow
                  label="Edits"
                  value={String(analytics.editCount)}
                />
              </>
            )}
            {wordCount > 0 && (
              <>
                <MetadataRow
                  label="Word count"
                  value={`${wordCount.toLocaleString()} words`}
                />
                <MetadataRow
                  label="Reading time"
                  value={estimateReadingTime(wordCount)}
                />
              </>
            )}
            <MetadataRow
              label="Versions"
              value={String(versionCount)}
            />
            <MetadataRow
              label="Unique collaborators"
              value={
                uniqueCollaborators.length > 0
                  ? String(uniqueCollaborators.length)
                  : "1 (you)"
              }
            />
            {uniqueCollaborators.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-1">
                  Contributors
                </p>
                <div className="flex flex-wrap gap-1">
                  {uniqueCollaborators.slice(0, 10).map((name) => (
                    <span
                      key={name}
                      className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-600"
                    >
                      {name}
                    </span>
                  ))}
                  {uniqueCollaborators.length > 10 && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs text-gray-400">
                      +{uniqueCollaborators.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-900">{value}</span>
    </div>
  );
}

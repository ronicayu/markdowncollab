"use client";

import { useState } from "react";

interface DuplicateDialogProps {
  documentId: string;
  documentTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onDuplicated: (newDocId: string) => void;
}

export default function DuplicateDialog({
  documentId,
  documentTitle,
  isOpen,
  onClose,
  onDuplicated,
}: DuplicateDialogProps) {
  const [title, setTitle] = useState(`Copy of ${documentTitle || "Untitled"}`);
  const [includeComments, setIncludeComments] = useState(true);
  const [includeVersions, setIncludeVersions] = useState(false);
  const [includeTags, setIncludeTags] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleDuplicate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          includeComments,
          includeVersions,
          includeTags,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onDuplicated(data.id);
        onClose();
      }
    } finally {
      setLoading(false);
    }
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
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Duplicate Document
        </h3>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
              autoFocus
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-700">Include:</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A]"
              />
              <div>
                <p className="text-sm text-gray-900">Comments</p>
                <p className="text-xs text-gray-500">
                  Copy inline comments and discussions
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVersions}
                onChange={(e) => setIncludeVersions(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A]"
              />
              <div>
                <p className="text-sm text-gray-900">Version history</p>
                <p className="text-xs text-gray-500">
                  Copy all saved versions and snapshots
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTags}
                onChange={(e) => setIncludeTags(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A]"
              />
              <div>
                <p className="text-sm text-gray-900">Tags</p>
                <p className="text-xs text-gray-500">
                  Copy all document tags
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={loading || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#B8692A] hover:bg-[#96541F] rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? "Duplicating..." : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}

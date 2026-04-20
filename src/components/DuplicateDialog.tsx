"use client";

import { useState, useEffect } from "react";

interface FolderOption {
  id: string;
  name: string;
  parentId: string | null;
  children?: FolderOption[];
}

function flattenFolders(folders: FolderOption[], depth = 0): { id: string; name: string; depth: number }[] {
  const result: { id: string; name: string; depth: number }[] = [];
  for (const f of folders) {
    result.push({ id: f.id, name: f.name, depth });
    if (f.children && f.children.length > 0) {
      result.push(...flattenFolders(f.children, depth + 1));
    }
  }
  return result;
}

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
  const [folderId, setFolderId] = useState("");
  const [folders, setFolders] = useState<{ id: string; name: string; depth: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    fetch("/api/folders", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: FolderOption[]) => {
        if (Array.isArray(data)) {
          setFolders(flattenFolders(data));
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch folders:", err);
      });
    return () => controller.abort();
  }, [isOpen]);

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
          folderId: folderId || undefined,
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
        <h3 className="text-base font-semibold text-[#31302e] mb-4">
          Duplicate Document
        </h3>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#31302e] mb-1">
              New title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0075de] focus:ring-1 focus:ring-[#0075de]"
              autoFocus
            />
          </div>

          {/* Folder selector */}
          {folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#31302e] mb-1">
                Destination folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0075de] focus:ring-1 focus:ring-[#0075de]"
              >
                <option value="">No folder (root)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {"\u00A0\u00A0".repeat(f.depth)}{f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#31302e]">Include:</p>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="h-4 w-4 rounded border-[#dddddd] text-[#0075de] focus:ring-[#0075de]"
              />
              <div>
                <p className="text-sm text-[#31302e]">Comments</p>
                <p className="text-xs text-[#615d59]">
                  Copy inline comments and discussions
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeVersions}
                onChange={(e) => setIncludeVersions(e.target.checked)}
                className="h-4 w-4 rounded border-[#dddddd] text-[#0075de] focus:ring-[#0075de]"
              />
              <div>
                <p className="text-sm text-[#31302e]">Version history</p>
                <p className="text-xs text-[#615d59]">
                  Copy all saved versions and snapshots
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeTags}
                onChange={(e) => setIncludeTags(e.target.checked)}
                className="h-4 w-4 rounded border-[#dddddd] text-[#0075de] focus:ring-[#0075de]"
              />
              <div>
                <p className="text-sm text-[#31302e]">Tags</p>
                <p className="text-xs text-[#615d59]">
                  Copy all document tags
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#615d59] hover:text-[#31302e] rounded-lg hover:bg-[#f6f5f4] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={loading || !title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0075de] hover:bg-[#005bab] rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? "Duplicating..." : "Duplicate"}
          </button>
        </div>
      </div>
    </div>
  );
}

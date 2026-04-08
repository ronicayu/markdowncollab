"use client";

import React from "react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children: Folder[];
}

interface BulkActionsBarProps {
  selectedCount: number;
  selected: Set<string>;
  bulkDeleting: boolean;
  bulkTagging: boolean;
  merging: boolean;
  showBulkTagPopover: boolean;
  bulkMoveOpen: boolean;
  bulkShareOpen: boolean;
  bulkShareEmail: string;
  bulkShareRole: "viewer" | "editor";
  allTags: Tag[];
  docTags: Record<string, Tag[]>;
  folders: Folder[];
  newTagName: string;
  newTagColor: string;
  TAG_PRESET_COLORS: { label: string; value: string }[];
  onBulkDelete: () => void;
  onBulkAddTag: (tagId: string) => void;
  onBulkRemoveTag: (tagId: string) => void;
  onBulkMoveToFolder: (folderId: string | null) => void;
  onBulkShare: () => void;
  onMergeDocuments: () => void;
  onSetShowBulkTagPopover: (v: boolean) => void;
  onSetBulkMoveOpen: (v: boolean) => void;
  onSetBulkShareOpen: (v: boolean) => void;
  onSetBulkShareEmail: (v: string) => void;
  onSetBulkShareRole: (v: "viewer" | "editor") => void;
  onSetNewTagName: (v: string) => void;
  onSetNewTagColor: (v: string) => void;
  onSetAllTags: React.Dispatch<React.SetStateAction<Tag[]>>;
  onCancel: () => void;
}

export default function BulkActionsBar({
  selectedCount,
  selected,
  bulkDeleting,
  bulkTagging,
  merging,
  showBulkTagPopover,
  bulkMoveOpen,
  bulkShareOpen,
  bulkShareEmail,
  bulkShareRole,
  allTags,
  docTags,
  folders,
  newTagName,
  newTagColor,
  TAG_PRESET_COLORS,
  onBulkDelete,
  onBulkAddTag,
  onBulkRemoveTag,
  onBulkMoveToFolder,
  onBulkShare,
  onMergeDocuments,
  onSetShowBulkTagPopover,
  onSetBulkMoveOpen,
  onSetBulkShareOpen,
  onSetBulkShareEmail,
  onSetBulkShareRole,
  onSetNewTagName,
  onSetNewTagColor,
  onSetAllTags,
  onCancel,
}: BulkActionsBarProps) {
  return (
    <div className="relative flex items-center gap-3 bg-[#111110] text-white rounded-xl px-4 py-3 mb-2">
      <span className="text-sm">{selectedCount} selected</span>
      <button
        onClick={onBulkDelete}
        disabled={bulkDeleting}
        className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
      >
        {bulkDeleting ? "Deleting..." : "Delete"}
      </button>
      <button
        onClick={() => onSetShowBulkTagPopover(!showBulkTagPopover)}
        disabled={bulkTagging}
        className="text-sm font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
      >
        {bulkTagging ? "Tagging..." : "Tag"}
      </button>
      {showBulkTagPopover && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Tag {selectedCount} documents</p>
            <button onClick={() => onSetShowBulkTagPopover(false)} className="text-gray-400 hover:text-gray-600 text-xs">
              x
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
            {allTags.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No tags yet</p>
            ) : (
              allTags.map((tag) => {
                const allHave = [...selected].every((docId) =>
                  (docTags[docId] || []).some((t) => t.id === tag.id)
                );
                const someHave = [...selected].some((docId) =>
                  (docTags[docId] || []).some((t) => t.id === tag.id)
                );
                return (
                  <button
                    key={tag.id}
                    onClick={() => allHave ? onBulkRemoveTag(tag.id) : onBulkAddTag(tag.id)}
                    className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                      allHave ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="truncate text-gray-700">{tag.name}</span>
                    {allHave && <span className="ml-auto text-xs text-gray-400">&#10003;</span>}
                    {!allHave && someHave && <span className="ml-auto text-xs text-gray-400">&#8212;</span>}
                  </button>
                );
              })
            )}
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = newTagName.trim();
              if (!trimmed) return;
              const res = await fetch("/api/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: trimmed, color: newTagColor }),
              });
              const tag = await res.json();
              if (tag && tag.id) {
                onSetAllTags((prev: Tag[]) => {
                  if (prev.some((t) => t.id === tag.id)) return prev;
                  return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
                });
                await onBulkAddTag(tag.id);
              }
              onSetNewTagName("");
              onSetNewTagColor("#6b7280");
            }}
            className="space-y-1.5"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => onSetNewTagName(e.target.value)}
                placeholder="New tag..."
                className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-[#B8692A]"
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="px-2 py-1 rounded bg-[#B8692A] text-white text-xs font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {newTagName.trim() && (
              <div className="flex items-center gap-1">
                {TAG_PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onSetNewTagColor(c.value)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${newTagColor === c.value ? "border-gray-800 scale-110" : "border-transparent hover:border-gray-300"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            )}
          </form>
        </div>
      )}
      <a
        href={`/api/documents/export?ids=${[...selected].join(",")}`}
        className="text-sm font-medium text-amber-400 hover:text-amber-300"
      >
        Export ZIP
      </a>
      <button
        onClick={() => onSetBulkMoveOpen(!bulkMoveOpen)}
        className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
      >
        Move
      </button>
      {bulkMoveOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Move {selectedCount} docs to folder</p>
            <button onClick={() => onSetBulkMoveOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">x</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <button
              onClick={() => onBulkMoveToFolder(null)}
              className="w-full text-left px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              No folder (root)
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => onBulkMoveToFolder(f.id)}
                className="w-full text-left px-2 py-1 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => onSetBulkShareOpen(!bulkShareOpen)}
        className="text-sm font-medium text-pink-400 hover:text-pink-300"
      >
        Share
      </button>
      {bulkShareOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-64"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Share {selectedCount} docs</p>
            <button onClick={() => onSetBulkShareOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">x</button>
          </div>
          <input
            type="email"
            value={bulkShareEmail}
            onChange={(e) => onSetBulkShareEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-[#B8692A] mb-2"
          />
          <select
            value={bulkShareRole}
            onChange={(e) => onSetBulkShareRole(e.target.value as "viewer" | "editor")}
            className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 outline-none focus:border-[#B8692A] mb-2"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={onBulkShare}
            disabled={!bulkShareEmail.trim()}
            className="w-full px-2 py-1 rounded bg-[#B8692A] text-white text-xs font-medium disabled:opacity-40"
          >
            Share
          </button>
        </div>
      )}
      {selectedCount === 2 && (
        <>
          <a
            href={`/compare?a=${[...selected][0]}&b=${[...selected][1]}`}
            className="text-sm font-medium text-blue-400 hover:text-blue-300"
          >
            Compare
          </a>
          <a
            href={`/split?left=${[...selected][0]}&right=${[...selected][1]}`}
            className="text-sm font-medium text-teal-400 hover:text-teal-300"
          >
            Split View
          </a>
          <button
            onClick={onMergeDocuments}
            disabled={merging}
            className="text-sm font-medium text-purple-400 hover:text-purple-300 disabled:opacity-50"
          >
            {merging ? "Merging..." : "Merge"}
          </button>
        </>
      )}
      <button
        onClick={onCancel}
        className="text-sm text-white/50 hover:text-white ml-auto"
      >
        Cancel
      </button>
    </div>
  );
}

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
  onMergeDocuments: () => void;
  onSetShowBulkTagPopover: (v: boolean) => void;
  onSetBulkMoveOpen: (v: boolean) => void;
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
  onMergeDocuments,
  onSetShowBulkTagPopover,
  onSetBulkMoveOpen,
  onSetNewTagName,
  onSetNewTagColor,
  onSetAllTags,
  onCancel,
}: BulkActionsBarProps) {
  return (
    <div className="relative flex items-center gap-3 bg-[#31302e] text-white rounded-xl px-4 py-3 mb-2">
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
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-[rgba(0,0,0,0.1)] p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#31302e]">Tag {selectedCount} documents</p>
            <button onClick={() => onSetShowBulkTagPopover(false)} className="text-[#a39e98] hover:text-[#615d59] text-xs">
              x
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
            {allTags.length === 0 ? (
              <p className="text-xs text-[#a39e98] text-center py-2">No tags yet</p>
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
                      allHave ? "bg-[#f6f5f4] font-medium" : "hover:bg-[#f6f5f4]"
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="truncate text-[#31302e]">{tag.name}</span>
                    {allHave && <span className="ml-auto text-xs text-[#a39e98]">&#10003;</span>}
                    {!allHave && someHave && <span className="ml-auto text-xs text-[#a39e98]">&#8212;</span>}
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
                className="flex-1 min-w-0 rounded border border-[rgba(0,0,0,0.1)] px-2 py-1 text-xs text-[#31302e] outline-none focus:border-[#0075de]"
              />
              <button
                type="submit"
                disabled={!newTagName.trim()}
                className="px-2 py-1 rounded bg-[#0075de] text-white text-xs font-medium disabled:opacity-40"
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
                    className={`w-5 h-5 rounded-full border-2 transition-all ${newTagColor === c.value ? "border-[#31302e] scale-110" : "border-transparent hover:border-[#dddddd]"}`}
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
        className="text-sm font-medium text-[#dd5b00] hover:text-[#dd5b00]"
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
          className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-[rgba(0,0,0,0.1)] p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-[#31302e]">Move {selectedCount} docs to folder</p>
            <button onClick={() => onSetBulkMoveOpen(false)} className="text-[#a39e98] hover:text-[#615d59] text-xs">x</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            <button
              onClick={() => onBulkMoveToFolder(null)}
              className="w-full text-left px-2 py-1 rounded text-sm text-[#31302e] hover:bg-[#f6f5f4]"
            >
              No folder (root)
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => onBulkMoveToFolder(f.id)}
                className="w-full text-left px-2 py-1 rounded text-sm text-[#31302e] hover:bg-[#f6f5f4]"
              >
                {f.name}
              </button>
            ))}
          </div>
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

"use client";

import React from "react";
import Link from "next/link";


interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
  deletedAt?: string | null;
  role?: string;
  ownerId?: string | null;
  starred?: boolean;
  folderId?: string | null;
  status?: string;
}

interface DocumentRowProps {
  doc: Doc;
  index: number;
  focusedIndex: number;
  formatDate: (dateStr: string) => string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleStar: (docId: string, e: React.MouseEvent) => void;
  onTogglePin: (docId: string, e: React.MouseEvent) => void;
  pinnedIds: Set<string>;
  editingId: string | null;
  editTitle: string;
  onSetEditingId: (id: string | null) => void;
  onSetEditTitle: (title: string) => void;
  onCommitRename: (docId: string) => void;
  docTags: Tag[];
  onRemoveTagFromDoc: (docId: string, tagId: string) => void;
  docReactions: Array<{ emoji: string; count: number; userIds: string[] }>;
  onToggleReaction: (docId: string, emoji: string) => void;
  reactionPickerDocId: string | null;
  onSetReactionPickerDocId: (id: string | null) => void;
  docRating: number | undefined;
  deletingId: string | null;
  onConfirmDelete: (doc: Doc) => void;
  onDuplicateDoc: (doc: Doc) => void;
  onForkDoc: (doc: Doc) => void;
  tagPopoverDocId: string | null;
  onSetTagPopoverDocId: (id: string | null) => void;
  allTags: Tag[];
  onAddTagToDoc: (docId: string, tagId: string) => void;
  newTagName: string;
  onSetNewTagName: (v: string) => void;
  newTagColor: string;
  onSetNewTagColor: (v: string) => void;
  TAG_PRESET_COLORS: { label: string; value: string }[];
  onCreateAndAddTag: (docId: string, name: string) => void;
  analyticsDocId: string | null;
  onSetAnalyticsDocId: (id: string | null) => void;
  analyticsData: {
    viewCount: number;
    editCount: number;
    collaboratorCount: number;
    createdAt: string;
    lastEditedAt: string;
  } | null;
  onSetAnalyticsData: (data: { viewCount: number; editCount: number; collaboratorCount: number; createdAt: string; lastEditedAt: string } | null) => void;
  onSetAnalyticsLoading: (v: boolean) => void;
}

export default function DocumentRow({
  doc,
  index,
  focusedIndex,
  formatDate,
  selected,
  onToggleSelect,
  onToggleStar,
  onTogglePin,
  pinnedIds,
  editingId,
  editTitle,
  onSetEditingId,
  onSetEditTitle,
  onCommitRename,
  docTags,
  onRemoveTagFromDoc,
  docReactions,
  onToggleReaction,
  reactionPickerDocId,
  onSetReactionPickerDocId,
  docRating,
  deletingId,
  onConfirmDelete,
  onDuplicateDoc,
  onForkDoc,
  tagPopoverDocId,
  onSetTagPopoverDocId,
  allTags,
  onAddTagToDoc,
  newTagName,
  onSetNewTagName,
  newTagColor,
  onSetNewTagColor,
  TAG_PRESET_COLORS,
  onCreateAndAddTag,
  analyticsDocId,
  onSetAnalyticsDocId,
  analyticsData,
  onSetAnalyticsData,
  onSetAnalyticsLoading,
}: DocumentRowProps) {
  return (
    <div
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", doc.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`relative group flex items-center gap-2 ${focusedIndex === index ? "ring-2 ring-[#B8692A] rounded-xl" : ""}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(doc.id)}
        className="shrink-0 h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A] md:opacity-0 md:group-hover:opacity-100 transition-opacity checked:!opacity-100 cursor-pointer"
      />
      <button
        onClick={(e) => onToggleStar(doc.id, e)}
        className={`shrink-0 p-0.5 rounded transition-colors ${
          doc.starred
            ? "text-amber-500"
            : "text-gray-300 hover:text-amber-400 md:opacity-0 md:group-hover:opacity-100"
        }`}
        title={doc.starred ? "Unstar document" : "Star document"}
      >
        <svg className="h-4 w-4" fill={doc.starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </button>
      <button
        onClick={(e) => onTogglePin(doc.id, e)}
        className={`shrink-0 p-0.5 rounded transition-colors ${
          pinnedIds.has(doc.id)
            ? "text-[#B8692A]"
            : "text-gray-300 hover:text-[#B8692A] md:opacity-0 md:group-hover:opacity-100"
        }`}
        title={pinnedIds.has(doc.id) ? "Unpin document" : "Pin document"}
      >
        <svg className="h-4 w-4" fill={pinnedIds.has(doc.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l-4 4-4-4M12 7v10m-5 4h10" />
        </svg>
      </button>
      <Link
        href={`/doc/${doc.id}`}
        className="flex-1 flex items-center justify-between bg-[#FFFEF9] rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-amber-200 transition-all"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-1 h-8 rounded-full bg-[#B8692A] md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0" />
          <div className="min-w-0">
            {editingId === doc.id ? (
              <input
                autoFocus
                value={editTitle}
                onChange={(e) => onSetEditTitle(e.target.value)}
                onBlur={() => onCommitRename(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") onSetEditingId(null);
                }}
                onClick={(e) => e.preventDefault()}
                className="font-medium text-gray-900 bg-white border border-[#B8692A] rounded px-1.5 py-0.5 outline-none w-full"
              />
            ) : (
              <>
              <p
                className="font-medium text-gray-900 truncate"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  onSetEditingId(doc.id);
                  onSetEditTitle(doc.title || "Untitled");
                }}
              >
                {doc.title || "Untitled"}
              </p>
              {doc.role && doc.role !== "owner" && doc.ownerId && (
                <span className={`inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                  doc.role === "editor"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {doc.role === "editor" ? "Editor" : "Viewer"}
                </span>
              )}
              {doc.status && doc.status !== "draft" && (
                <span className={`inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                  doc.status === "approved"
                    ? "bg-green-50 text-green-700"
                    : "bg-amber-50 text-amber-700"
                }`}>
                  {doc.status === "approved" ? "Approved" : "In Review"}
                </span>
              )}
              {docTags.length > 0 && (
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {docTags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveTagFromDoc(doc.id, tag.id); }}
                        className="hover:opacity-70 ml-0.5"
                      >
                        x
                      </button>
                    </span>
                  ))}
                </div>
              )}
              {/* Quick Reactions */}
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {(docReactions || []).map((r) => (
                  <button
                    key={r.emoji}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleReaction(doc.id, r.emoji); }}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs bg-gray-100 hover:bg-gray-200 transition-colors"
                    title={`${r.count} reaction${r.count > 1 ? "s" : ""}`}
                  >
                    <span>{r.emoji}</span>
                    <span className="text-gray-500 text-[10px]">{r.count}</span>
                  </button>
                ))}
                <div className="relative">
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetReactionPickerDocId(reactionPickerDocId === doc.id ? null : doc.id); }}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100"
                    title="Add reaction"
                  >
                    +
                  </button>
                  {reactionPickerDocId === doc.id && (
                    <div
                      className="absolute left-0 bottom-full mb-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-1.5 flex gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F680}", "\u{1F389}", "\u{1F440}", "\u{1F4AF}"].map((emoji) => (
                        <button
                          key={emoji}
                          onClick={(e) => { e.preventDefault(); onToggleReaction(doc.id, emoji); onSetReactionPickerDocId(null); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-base transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
          </div>
        </div>
        {docRating !== undefined && docRating > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-500 shrink-0 ml-2" title={`Rating: ${docRating}/5`}>
            <svg className="h-3 w-3" fill="#F59E0B" viewBox="0 0 24 24" stroke="none">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            {docRating}
          </span>
        )}
        <span className="flex items-center gap-2 text-xs text-gray-400 shrink-0 ml-4 mr-16">
          {formatDate(doc.updatedAt)}
        </span>
      </Link>
      {/* Tag popover */}
      {tagPopoverDocId === doc.id && (
        <div
          className="absolute right-3 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Add tag</p>
            <button onClick={() => onSetTagPopoverDocId(null)} className="text-gray-400 hover:text-gray-600 text-xs">
              x
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
            {allTags.map((tag) => {
              const isApplied = docTags.some((t) => t.id === tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => isApplied ? onRemoveTagFromDoc(doc.id, tag.id) : onAddTagToDoc(doc.id, tag.id)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                    isApplied ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="truncate text-gray-700">{tag.name}</span>
                  {isApplied && <span className="ml-auto text-xs text-gray-400">&#10003;</span>}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); if (newTagName.trim()) onCreateAndAddTag(doc.id, newTagName.trim()); }}
            className="space-y-1.5"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => onSetNewTagName(e.target.value)}
                placeholder="New tag..."
                className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#B8692A]"
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
      {/* Analytics popover */}
      {analyticsDocId === doc.id && analyticsData && (
        <div
          className="absolute right-3 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-700">Analytics</p>
            <button onClick={() => onSetAnalyticsDocId(null)} className="text-gray-400 hover:text-gray-600 text-xs">x</button>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600">
            <div className="flex justify-between"><span>Views</span><span className="font-medium text-gray-900">{analyticsData.viewCount}</span></div>
            <div className="flex justify-between"><span>Activity events</span><span className="font-medium text-gray-900">{analyticsData.editCount}</span></div>
            <div className="flex justify-between"><span>Collaborators</span><span className="font-medium text-gray-900">{analyticsData.collaboratorCount}</span></div>
            <div className="flex justify-between"><span>Created</span><span className="font-medium text-gray-900">{formatDate(analyticsData.createdAt)}</span></div>
            <div className="flex justify-between"><span>Last edited</span><span className="font-medium text-gray-900">{formatDate(analyticsData.lastEditedAt)}</span></div>
          </div>
        </div>
      )}
      {/* Analytics + Tag + Duplicate + Delete buttons — appear on hover */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (analyticsDocId === doc.id) {
              onSetAnalyticsDocId(null);
              return;
            }
            onSetAnalyticsDocId(doc.id);
            onSetAnalyticsLoading(true);
            fetch(`/api/documents/${doc.id}/analytics`)
              .then((r) => r.ok ? r.json() : null)
              .then((data) => { if (data) onSetAnalyticsData(data); })
              .catch(() => {})
              .finally(() => onSetAnalyticsLoading(false));
          }}
          className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
          title="View analytics"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSetTagPopoverDocId(tagPopoverDocId === doc.id ? null : doc.id); onSetNewTagName(""); }}
          className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
          title="Manage tags"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onForkDoc(doc); }}
          className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
          title="Fork document"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onDuplicateDoc(doc); }}
          className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
          title="Duplicate document"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onConfirmDelete(doc); }}
          disabled={deletingId === doc.id}
          className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
          title="Delete document"
        >
          {deletingId === doc.id ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

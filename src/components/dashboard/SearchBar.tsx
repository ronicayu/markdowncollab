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

interface SearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  showRecentSearches: boolean;
  onSetShowRecentSearches: (v: boolean) => void;
  recentSearches: string[];
  onSetRecentSearches: React.Dispatch<React.SetStateAction<string[]>>;
  sortBy: "date" | "name";
  onSetSortBy: React.Dispatch<React.SetStateAction<"date" | "name">>;
  relativeDates: boolean;
  onSetRelativeDates: (v: boolean) => void;
  showSearchFilters: boolean;
  onSetShowSearchFilters: (v: boolean) => void;
  searchTagFilter: string;
  onSetSearchTagFilter: (v: string) => void;
  searchFolderFilter: string;
  onSetSearchFolderFilter: (v: string) => void;
  searchDateFrom: string;
  onSetSearchDateFrom: (v: string) => void;
  searchDateTo: string;
  onSetSearchDateTo: (v: string) => void;
  allTags: Tag[];
  folders: Folder[];
}

export default function SearchBar({
  search,
  onSearchChange,
  searchInputRef,
  showRecentSearches,
  onSetShowRecentSearches,
  recentSearches,
  onSetRecentSearches,
  sortBy,
  onSetSortBy,
  relativeDates,
  onSetRelativeDates,
  showSearchFilters,
  onSetShowSearchFilters,
  searchTagFilter,
  onSetSearchTagFilter,
  searchFolderFilter,
  onSetSearchFolderFilter,
  searchDateFrom,
  onSetSearchDateFrom,
  searchDateTo,
  onSetSearchDateTo,
  allTags,
  folders,
}: SearchBarProps) {
  return (
    <>
      <div className="flex items-center gap-2 flex-1 max-w-sm">
        <div className="relative flex-1 min-w-0">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search titles and content..."
            value={search}
            onChange={(e) => { onSearchChange(e.target.value); onSetShowRecentSearches(false); }}
            onFocus={() => { if (!search.trim() && recentSearches.length > 0) onSetShowRecentSearches(true); }}
            onBlur={() => { setTimeout(() => onSetShowRecentSearches(false), 150); }}
            className="w-full rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm outline-none placeholder:text-gray-400 focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
          />
          {showRecentSearches && recentSearches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
              <p className="px-3 py-1 text-[10px] text-gray-400 font-medium uppercase tracking-wide">Recent searches</p>
              {recentSearches.map((q) => (
                <button
                  key={q}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSearchChange(q);
                    onSetShowRecentSearches(false);
                    searchInputRef.current?.focus();
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-amber-50 hover:text-[#B8692A] transition-colors flex items-center gap-2"
                >
                  <svg className="h-3 w-3 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {q}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSetRecentSearches([]);
                    try { localStorage.removeItem("recentSearches"); } catch {}
                    onSetShowRecentSearches(false);
                  }}
                  className="w-full text-left px-3 py-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
                >
                  Clear history
                </button>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={() => onSetSortBy(sortBy === "date" ? "name" : "date")}
          className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-black/10 bg-white/60 text-xs text-gray-500 hover:text-gray-700 hover:border-black/20 transition-colors"
          title={`Sort by ${sortBy === "date" ? "name" : "date"}`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h12M3 17h6" />
          </svg>
          <span className="hidden sm:inline">{sortBy === "date" ? "Date" : "Name"}</span>
        </button>
        <button
          onClick={() => {
            const next = !relativeDates;
            onSetRelativeDates(next);
            try { localStorage.setItem("relativeDates", String(next)); } catch {}
          }}
          className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
            !relativeDates
              ? "border-[#B8692A]/40 bg-amber-50 text-[#B8692A]"
              : "border-black/10 bg-white/60 text-gray-500 hover:text-gray-700 hover:border-black/20"
          }`}
          title={relativeDates ? "Switch to absolute dates" : "Switch to relative dates"}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="hidden sm:inline">{relativeDates ? "Relative" : "Absolute"}</span>
        </button>
        <button
          onClick={() => onSetShowSearchFilters(!showSearchFilters)}
          className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
            showSearchFilters || searchTagFilter || searchFolderFilter || searchDateFrom || searchDateTo
              ? "border-[#B8692A]/40 bg-amber-50 text-[#B8692A]"
              : "border-black/10 bg-white/60 text-gray-500 hover:text-gray-700 hover:border-black/20"
          }`}
          title="Toggle search filters"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
          </svg>
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>
    </>
  );
}

interface SearchFiltersRowProps {
  showSearchFilters: boolean;
  searchTagFilter: string;
  onSetSearchTagFilter: (v: string) => void;
  searchFolderFilter: string;
  onSetSearchFolderFilter: (v: string) => void;
  searchDateFrom: string;
  onSetSearchDateFrom: (v: string) => void;
  searchDateTo: string;
  onSetSearchDateTo: (v: string) => void;
  allTags: Tag[];
  folders: Folder[];
}

export function SearchFiltersRow({
  showSearchFilters,
  searchTagFilter,
  onSetSearchTagFilter,
  searchFolderFilter,
  onSetSearchFolderFilter,
  searchDateFrom,
  onSetSearchDateFrom,
  searchDateTo,
  onSetSearchDateTo,
  allTags,
  folders,
}: SearchFiltersRowProps) {
  if (!showSearchFilters) return null;

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-[#F2E8D5] border-b border-black/5 flex-wrap">
      <select
        value={searchTagFilter}
        onChange={(e) => onSetSearchTagFilter(e.target.value)}
        className="rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#B8692A]"
      >
        <option value="">All tags</option>
        {allTags.map((tag) => (
          <option key={tag.id} value={tag.name}>{tag.name}</option>
        ))}
      </select>
      <select
        value={searchFolderFilter}
        onChange={(e) => onSetSearchFolderFilter(e.target.value)}
        className="rounded-lg border border-black/10 bg-white/60 px-2 py-1.5 text-xs text-gray-600 outline-none focus:border-[#B8692A]"
      >
        <option value="">All folders</option>
        {(function flattenFolders(nodes: Folder[], depth: number): React.ReactNode[] {
          return nodes.flatMap((f) => [
            <option key={f.id} value={f.id}>{"  ".repeat(depth) + f.name}</option>,
            ...flattenFolders(f.children, depth + 1),
          ]);
        })(folders, 0)}
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">From</span>
        <input
          type="date"
          value={searchDateFrom}
          onChange={(e) => onSetSearchDateFrom(e.target.value)}
          className="rounded-lg border border-black/10 bg-white/60 px-2 py-1 text-xs text-gray-600 outline-none focus:border-[#B8692A]"
        />
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">To</span>
        <input
          type="date"
          value={searchDateTo}
          onChange={(e) => onSetSearchDateTo(e.target.value)}
          className="rounded-lg border border-black/10 bg-white/60 px-2 py-1 text-xs text-gray-600 outline-none focus:border-[#B8692A]"
        />
      </div>
      {(searchTagFilter || searchFolderFilter || searchDateFrom || searchDateTo) && (
        <button
          onClick={() => {
            onSetSearchTagFilter("");
            onSetSearchFolderFilter("");
            onSetSearchDateFrom("");
            onSetSearchDateTo("");
          }}
          className="text-xs text-[#B8692A] hover:text-[#96541F] font-medium transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

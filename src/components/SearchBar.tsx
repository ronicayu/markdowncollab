"use client";

import { useRef, useEffect, useState } from "react";

interface SearchBarProps {
  query: string;
  matchCount: number;
  currentIndex: number;
  caseSensitive: boolean;
  showReplace: boolean;
  onQueryChange: (query: string) => void;
  onFindNext: () => void;
  onFindPrevious: () => void;
  onReplace: (replacement: string) => void;
  onReplaceAll: (replacement: string) => void;
  onToggleCaseSensitive: () => void;
  onToggleReplace: () => void;
  onClose: () => void;
}

export default function SearchBar({
  query,
  matchCount,
  currentIndex,
  caseSensitive,
  showReplace,
  onQueryChange,
  onFindNext,
  onFindPrevious,
  onReplace,
  onReplaceAll,
  onToggleCaseSensitive,
  onToggleReplace,
  onClose,
}: SearchBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [replaceValue, setReplaceValue] = useState("");

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      onFindPrevious();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onFindNext();
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      onReplace(replaceValue);
    }
  };

  const matchDisplay = query
    ? matchCount > 0
      ? `${currentIndex + 1} of ${matchCount}`
      : "0 results"
    : "";

  return (
    <div role="search" aria-label="Find and replace" className="border-b border-[rgba(0,0,0,0.1)] bg-white px-3 py-2 flex flex-col gap-2">
      {/* Search row */}
      <div className="flex items-center gap-2">
        {/* Expand/collapse replace toggle */}
        <button
          onClick={onToggleReplace}
          title={showReplace ? "Hide replace" : "Show replace"}
          aria-label={showReplace ? "Hide replace" : "Show replace"}
          aria-expanded={showReplace}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-[#a39e98] hover:bg-[#f6f5f4] hover:text-[#615d59] transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className={`h-3.5 w-3.5 transition-transform ${showReplace ? "rotate-90" : ""}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Search input */}
        <div className="relative flex-1 max-w-sm">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Find..."
            aria-label="Search text"
            className="w-full h-8 pl-3 pr-16 text-sm border border-[#dddddd] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0075de] focus:border-[#0075de]"
          />
          {matchDisplay && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[#a39e98] pointer-events-none">
              {matchDisplay}
            </span>
          )}
        </div>

        {/* Case sensitive toggle */}
        <button
          onClick={onToggleCaseSensitive}
          title="Case sensitive"
          aria-label="Toggle case sensitive"
          aria-pressed={caseSensitive ? "true" : "false"}
          className={`h-7 w-7 shrink-0 rounded flex items-center justify-center text-xs font-bold transition-colors ${
            caseSensitive
              ? "bg-[#0075de]/10 text-[#0075de]"
              : "text-[#a39e98] hover:bg-[#f6f5f4] hover:text-[#615d59]"
          }`}
        >
          Aa
        </button>

        {/* Navigate matches */}
        <button
          onClick={onFindPrevious}
          title="Previous match"
          aria-label="Previous match"
          disabled={matchCount === 0}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-[#a39e98] hover:bg-[#f6f5f4] hover:text-[#615d59] disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onFindNext}
          title="Next match"
          aria-label="Next match"
          disabled={matchCount === 0}
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-[#a39e98] hover:bg-[#f6f5f4] hover:text-[#615d59] disabled:opacity-30 disabled:cursor-default transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close search"
          className="h-7 w-7 shrink-0 rounded flex items-center justify-center text-[#a39e98] hover:bg-[#f6f5f4] hover:text-[#615d59] transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-2 pl-9">
          <input
            type="text"
            value={replaceValue}
            onChange={(e) => setReplaceValue(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            placeholder="Replace..."
            className="flex-1 max-w-sm h-8 pl-3 pr-3 text-sm border border-[#dddddd] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0075de] focus:border-[#0075de]"
          />
          <button
            onClick={() => onReplace(replaceValue)}
            title="Replace"
            disabled={matchCount === 0}
            className="h-7 px-2 shrink-0 rounded text-xs text-[#615d59] hover:bg-[#f6f5f4] hover:text-[#31302e] disabled:opacity-30 disabled:cursor-default transition-colors border border-[#dddddd]"
          >
            Replace
          </button>
          <button
            onClick={() => onReplaceAll(replaceValue)}
            title="Replace all"
            disabled={matchCount === 0}
            className="h-7 px-2 shrink-0 rounded text-xs text-[#615d59] hover:bg-[#f6f5f4] hover:text-[#31302e] disabled:opacity-30 disabled:cursor-default transition-colors border border-[#dddddd]"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

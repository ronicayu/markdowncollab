"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface MentionUser {
  id: string;
  name: string;
  email: string;
}

interface MentionAutocompleteProps {
  users: MentionUser[];
  query: string;
  onSelect: (user: MentionUser) => void;
  onDismiss: () => void;
  visible: boolean;
}

export default function MentionAutocomplete({
  users,
  query,
  onSelect,
  onDismiss,
  visible,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  // Reset selection when query or visibility changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, visible]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    },
    [visible, filtered, selectedIndex, onSelect, onDismiss]
  );

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto"
    >
      {filtered.map((user, index) => (
        <button
          key={user.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(user);
          }}
          className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
            index === selectedIndex
              ? "bg-amber-50 text-amber-900"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white shrink-0">
            {user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <span className="truncate">{user.name}</span>
        </button>
      ))}
    </div>
  );
}

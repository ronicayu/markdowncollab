"use client";

import { useState, useRef, useEffect } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  name: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    emojis: [
      "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}", "\u{1F605}",
      "\u{1F602}", "\u{1F923}", "\u{1F60A}", "\u{1F607}", "\u{1F642}", "\u{1F643}",
      "\u{1F609}", "\u{1F60C}", "\u{1F60D}", "\u{1F970}", "\u{1F618}", "\u{1F617}",
      "\u{1F929}", "\u{1F60B}", "\u{1F61B}", "\u{1F61C}", "\u{1F92A}", "\u{1F914}",
      "\u{1F928}", "\u{1F610}", "\u{1F611}", "\u{1F636}", "\u{1F60F}", "\u{1F612}",
      "\u{1F644}", "\u{1F62C}", "\u{1F925}", "\u{1F60E}", "\u{1F913}", "\u{1F9D0}",
    ],
  },
  {
    name: "Hand Gestures",
    emojis: [
      "\u{1F44D}", "\u{1F44E}", "\u{1F44A}", "\u270A", "\u{1F91E}", "\u270C\uFE0F",
      "\u{1F91F}", "\u{1F918}", "\u{1F44C}", "\u{1F90F}", "\u{1F448}", "\u{1F449}",
      "\u{1F446}", "\u{1F447}", "\u261D\uFE0F", "\u270B", "\u{1F91A}", "\u{1F590}\uFE0F",
      "\u{1F44B}", "\u{1F44F}", "\u{1F64F}",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "\u{1F4A1}", "\u{1F525}", "\u2B50", "\u{1F31F}", "\u{1F4AF}", "\u{1F3AF}",
      "\u{1F680}", "\u{1F389}", "\u{1F388}", "\u{1F381}", "\u{1F3C6}", "\u{1F4DA}",
      "\u{1F4DD}", "\u270F\uFE0F", "\u{1F4E7}", "\u{1F4CC}", "\u{1F50D}", "\u{1F4A3}",
      "\u{1F6A9}", "\u2764\uFE0F", "\u{1F49A}", "\u{1F499}", "\u{1F49B}",
    ],
  },
  {
    name: "Symbols",
    emojis: [
      "\u2705", "\u274C", "\u2757", "\u2753", "\u{1F4A4}", "\u{1F4A2}",
      "\u{1F4AC}", "\u{1F5E8}\uFE0F", "\u{1F6AB}", "\u26A0\uFE0F", "\u267B\uFE0F",
      "\u2728", "\u{1F308}", "\u{1F532}", "\u{1F533}", "\u{1F534}", "\u{1F7E2}", "\u{1F535}",
      "\u{1F7E1}", "\u2B55",
    ],
  },
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [filter, setFilter] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const allEmojis = EMOJI_CATEGORIES.flatMap((cat) =>
    cat.emojis.map((e) => ({ emoji: e, category: cat.name }))
  );

  // Simple text-based filter isn't great for emojis, but we can filter by category name
  const filtered = filter.trim()
    ? allEmojis.filter((e) =>
        e.category.toLowerCase().includes(filter.toLowerCase())
      )
    : null;

  return (
    <div
      ref={ref}
      className="w-72 bg-[var(--dialog-bg,white)] rounded-xl shadow-lg border border-[var(--card-border)] p-2 z-50"
      onMouseDown={(e) => e.preventDefault()}
    >
      <input
        autoFocus
        type="text"
        placeholder="Filter by category..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] mb-2"
      />

      {filtered ? (
        <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
          {filtered.map((item, i) => (
            <button
              key={i}
              onClick={() => onSelect(item.emoji)}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-[var(--card-hover-bg)] text-lg transition-colors"
              title={item.category}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-2 border-b border-[var(--card-border)] pb-1">
            {EMOJI_CATEGORIES.map((cat, i) => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(i)}
                className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                  activeCategory === i
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] font-medium"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5 max-h-48 overflow-y-auto">
            {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, i) => (
              <button
                key={i}
                onClick={() => onSelect(emoji)}
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-[var(--card-hover-bg)] text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

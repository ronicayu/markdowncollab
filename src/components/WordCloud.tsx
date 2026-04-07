"use client";

import { useMemo } from "react";

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "am", "of", "in",
  "to", "for", "with", "on", "at", "from", "by", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same",
  "so", "than", "too", "very", "just", "about", "also", "and", "but",
  "or", "if", "while", "because", "that", "this", "these", "those",
  "it", "its", "he", "she", "they", "them", "their", "his", "her",
  "we", "you", "your", "my", "me", "i", "what", "which", "who", "whom",
  "up", "out", "over", "down", "off", "any", "s", "t", "don", "re",
  "ve", "ll", "d", "m", "o", "e", "w", "de",
]);

const PALETTE = [
  "#B8692A", "#2563EB", "#059669", "#7C3AED", "#DC2626",
  "#D97706", "#0891B2", "#4F46E5", "#BE185D", "#065F46",
  "#9333EA", "#CA8A04", "#0D9488", "#6366F1", "#E11D48",
];

interface WordCloudProps {
  text: string;
}

export default function WordCloud({ text }: WordCloudProps) {
  const words = useMemo(() => {
    const freq: Record<string, number> = {};
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

    for (const token of tokens) {
      const clean = token.replace(/^['-]+|['-]+$/g, "");
      if (clean.length > 2 && !STOP_WORDS.has(clean)) {
        freq[clean] = (freq[clean] || 0) + 1;
      }
    }

    const sorted = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (sorted.length === 0) return [];

    const maxCount = sorted[0][1];
    const minCount = sorted[sorted.length - 1][1];
    const range = maxCount - minCount || 1;

    return sorted.map(([word, count], i) => ({
      word,
      count,
      size: 12 + ((count - minCount) / range) * 36,
      color: PALETTE[i % PALETTE.length],
    }));
  }, [text]);

  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Not enough content for a word cloud.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-4">
      {words.map(({ word, count, size, color }) => (
        <span
          key={word}
          title={`${word}: ${count}`}
          style={{
            fontSize: `${size}px`,
            color,
            lineHeight: 1.2,
          }}
          className="font-semibold cursor-default transition-opacity hover:opacity-70"
        >
          {word}
        </span>
      ))}
    </div>
  );
}

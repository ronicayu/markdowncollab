"use client";

import { useState, useMemo } from "react";

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her",
  "she", "or", "an", "will", "my", "one", "all", "would", "there",
  "their", "what", "so", "up", "out", "if", "about", "who", "get",
  "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then",
  "now", "look", "only", "come", "its", "over", "think", "also",
  "back", "after", "use", "two", "how", "our", "work", "first",
  "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been",
  "being", "has", "had", "did", "does", "am", "very", "more", "much",
  "own", "may", "should", "each", "such", "both", "still", "here",
  "through", "while", "where", "those", "before", "too", "s", "t",
  "re", "ve", "ll", "d", "m", "don", "didn", "won", "isn", "aren",
  "wasn", "weren", "hasn", "hadn", "doesn", "wouldn", "couldn",
  "shouldn", "let", "de", "la", "le", "les", "un", "une", "des",
  "du", "et", "en", "est", "que", "qui", "dans", "pour", "ce",
]);

type SortField = "word" | "count";
type SortDir = "asc" | "desc";

interface WordFrequencyTableProps {
  text: string;
}

export default function WordFrequencyTable({ text }: WordFrequencyTableProps) {
  const [sortField, setSortField] = useState<SortField>("count");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const frequencies = useMemo(() => {
    const counts = new Map<string, number>();
    // Extract words: split on non-word characters, lowercase, filter stop words
    const words = text
      .toLowerCase()
      .split(/[^a-zA-Z0-9\u00C0-\u024F]+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    for (const word of words) {
      counts.set(word, (counts.get(word) || 0) + 1);
    }

    const totalWords = words.length;
    const entries = Array.from(counts.entries())
      .map(([word, count]) => ({
        word,
        count,
        percentage: totalWords > 0 ? ((count / totalWords) * 100).toFixed(1) : "0.0",
      }));

    return { entries, totalWords };
  }, [text]);

  const sorted = useMemo(() => {
    const items = [...frequencies.entries];
    items.sort((a, b) => {
      if (sortField === "word") {
        return sortDir === "asc" ? a.word.localeCompare(b.word) : b.word.localeCompare(a.word);
      }
      return sortDir === "asc" ? a.count - b.count : b.count - a.count;
    });
    return items.slice(0, 20);
  }, [frequencies, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "count" ? "desc" : "asc");
    }
  }

  const arrow = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u25B2" : " \u25BC";
  };

  if (sorted.length === 0) {
    return <p className="text-xs text-gray-400 py-2">Not enough content to analyze.</p>;
  }

  return (
    <div className="text-xs">
      <p className="text-gray-500 mb-2">
        Top 20 content words ({frequencies.totalWords} words analyzed)
      </p>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="py-1.5 pr-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900" onClick={() => toggleSort("word")}>
              Word{arrow("word")}
            </th>
            <th className="py-1.5 pr-2 font-medium text-gray-600 cursor-pointer select-none hover:text-gray-900 text-right" onClick={() => toggleSort("count")}>
              Count{arrow("count")}
            </th>
            <th className="py-1.5 font-medium text-gray-600 text-right">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => (
            <tr key={item.word} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="py-1 pr-2 text-gray-800 font-mono">{item.word}</td>
              <td className="py-1 pr-2 text-gray-600 text-right tabular-nums">{item.count}</td>
              <td className="py-1 text-gray-400 text-right tabular-nums">{item.percentage}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

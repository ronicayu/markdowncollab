"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface MatchLine {
  lineNumber: number;
  context: string;
}

interface DocResult {
  documentId: string;
  title: string;
  matches: MatchLine[];
}

interface ReplacementResult {
  documentId: string;
  title: string;
  count: number;
}

export default function SearchReplacePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [results, setResults] = useState<DocResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState<string | null>(null); // documentId or "all"
  const [replacementResults, setReplacementResults] = useState<ReplacementResult[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = searchTerm.trim();
    if (!q) return;
    setSearching(true);
    setHasSearched(true);
    setReplacementResults(null);
    try {
      const res = await fetch(`/api/documents/search-replace?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data: DocResult[] = await res.json();
        setResults(data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchTerm]);

  const handleReplace = useCallback(
    async (documentId?: string) => {
      const s = searchTerm.trim();
      const r = replaceTerm;
      if (!s) return;
      setReplacing(documentId ?? "all");
      try {
        const res = await fetch("/api/documents/search-replace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ search: s, replace: r, documentId }),
        });
        if (res.ok) {
          const data = await res.json();
          setReplacementResults(data.replacements);
          // Re-run search to update results
          const searchRes = await fetch(
            `/api/documents/search-replace?q=${encodeURIComponent(s)}`
          );
          if (searchRes.ok) {
            setResults(await searchRes.json());
          }
        }
      } catch {
        // silently fail
      } finally {
        setReplacing(null);
      }
    },
    [searchTerm, replaceTerm]
  );

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="min-h-screen bg-[#F2E8D5]">
      {/* Header */}
      <div className="bg-[#111110] text-white px-6 py-4 flex items-center gap-4">
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors"
          title="Back to documents"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold">Search &amp; Replace Across Documents</h1>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Search / Replace Inputs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Find text across all documents..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchTerm.trim()}
                  className="px-4 py-2 bg-[#B8692A] text-white text-sm font-medium rounded-md hover:bg-[#96541F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Replace with</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="Replacement text..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <button
                  onClick={() => handleReplace()}
                  disabled={!searchTerm.trim() || replacing !== null || results.length === 0}
                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {replacing === "all" ? "Replacing..." : "Replace All"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Replacement Success Banner */}
        {replacementResults && replacementResults.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-green-800">
              Replaced {replacementResults.reduce((s, r) => s + r.count, 0)} occurrences
              across {replacementResults.length} document{replacementResults.length > 1 ? "s" : ""}:
            </p>
            <ul className="mt-2 space-y-1">
              {replacementResults.map((r) => (
                <li key={r.documentId} className="text-xs text-green-700">
                  {r.title}: {r.count} replacement{r.count > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Results */}
        {hasSearched && !searching && (
          <div className="mb-4">
            <p className="text-sm text-gray-500">
              {results.length === 0
                ? "No matches found."
                : `${totalMatches} match${totalMatches !== 1 ? "es" : ""} in ${results.length} document${results.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {results.map((docResult) => (
            <div
              key={docResult.documentId}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/doc/${docResult.documentId}`}
                    className="text-sm font-medium text-gray-900 hover:text-amber-700 hover:underline"
                  >
                    {docResult.title || "Untitled"}
                  </Link>
                  <span className="text-xs text-gray-400">
                    {docResult.matches.length} match{docResult.matches.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleReplace(docResult.documentId)}
                  disabled={!searchTerm.trim() || replacing !== null}
                  className="px-3 py-1 text-xs font-medium text-red-600 border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {replacing === docResult.documentId ? "Replacing..." : "Replace in this document"}
                </button>
              </div>
              <ul className="divide-y divide-gray-50">
                {docResult.matches.slice(0, 20).map((match, idx) => (
                  <li key={idx} className="px-4 py-2 flex gap-3 text-sm">
                    <span className="text-gray-400 text-xs font-mono w-8 text-right shrink-0 pt-0.5">
                      {match.lineNumber}
                    </span>
                    <span
                      className="text-gray-700 break-all [&>mark]:bg-yellow-200 [&>mark]:rounded-sm [&>mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: match.context }}
                    />
                  </li>
                ))}
                {docResult.matches.length > 20 && (
                  <li className="px-4 py-2 text-xs text-gray-400 italic">
                    ...and {docResult.matches.length - 20} more matches
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

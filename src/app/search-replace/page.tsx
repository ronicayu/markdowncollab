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
    <div className="min-h-screen" style={{ background: "var(--page-bg)" }}>
      {/* Header: white surface with whisper border */}
      <div
        className="px-6 py-4 flex items-center gap-4 border-b"
        style={{ background: "var(--surface)", borderColor: "var(--rule)" }}
      >
        <Link
          href="/"
          className="hover:underline"
          title="Back to documents"
          style={{ color: "var(--accent)" }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1
          className="text-[22px] font-bold"
          style={{ color: "var(--ink)", letterSpacing: "-0.25px", lineHeight: 1.27 }}
        >
          Search &amp; Replace Across Documents
        </h1>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Search / Replace Inputs — standard card */}
        <div
          className="rounded-xl border p-5 mb-6"
          style={{
            background: "var(--surface)",
            borderColor: "var(--rule)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div className="space-y-3">
            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px" }}
              >
                Search
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Find text across all documents..."
                  className="flex-1 px-3 py-2 text-base rounded focus:outline-none"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    color: "var(--ink-2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-focus)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--input-border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={searching || !searchTerm.trim()}
                  className="text-[15px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--accent)",
                    color: "#ffffff",
                    padding: "8px 16px",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled)
                      e.currentTarget.style.background = "var(--accent-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--accent)";
                  }}
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
            <div>
              <label
                className="block text-xs font-semibold mb-1"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px" }}
              >
                Replace with
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replaceTerm}
                  onChange={(e) => setReplaceTerm(e.target.value)}
                  placeholder="Replacement text..."
                  className="flex-1 px-3 py-2 text-base rounded focus:outline-none"
                  style={{
                    background: "var(--input-bg)",
                    border: "1px solid var(--input-border)",
                    color: "var(--ink-2)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-focus)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--input-border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
                <button
                  onClick={() => handleReplace()}
                  disabled={!searchTerm.trim() || replacing !== null || results.length === 0}
                  className="text-[15px] font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "var(--accent)",
                    color: "#ffffff",
                    padding: "8px 16px",
                  }}
                  onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = "var(--accent-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
                >
                  {replacing === "all" ? "Replacing..." : "Replace All"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Replacement Success Banner */}
        {replacementResults && replacementResults.length > 0 && (
          <div
            className="rounded-xl border p-4 mb-6"
            style={{
              background: "var(--ok-soft)",
              borderColor: "var(--ok)",
            }}
          >
            <p className="text-base font-semibold" style={{ color: "var(--ok)" }}>
              Replaced {replacementResults.reduce((s, r) => s + r.count, 0)} occurrences
              across {replacementResults.length} document{replacementResults.length > 1 ? "s" : ""}:
            </p>
            <ul className="mt-2 space-y-1">
              {replacementResults.map((r) => (
                <li key={r.documentId} className="text-xs" style={{ color: "var(--ok)" }}>
                  {r.title}: {r.count} replacement{r.count > 1 ? "s" : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Results summary */}
        {hasSearched && !searching && (
          <div className="mb-4">
            <p className="text-base" style={{ color: "var(--ink-soft)" }}>
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
              className="rounded-xl border overflow-hidden"
              style={{
                background: "var(--surface)",
                borderColor: "var(--rule)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ background: "var(--surface-2)", borderColor: "var(--rule)" }}
              >
                <div className="flex items-center gap-2">
                  <Link
                    href={`/doc/${docResult.documentId}`}
                    className="text-[15px] font-semibold hover:underline"
                    style={{ color: "var(--ink)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink)")}
                  >
                    {docResult.title || "Untitled"}
                  </Link>
                  <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                    {docResult.matches.length} match{docResult.matches.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleReplace(docResult.documentId)}
                  disabled={!searchTerm.trim() || replacing !== null}
                  className="px-3 py-1 text-xs font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    color: "var(--warn)",
                    border: "1px solid var(--warn)",
                    background: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.disabled)
                      e.currentTarget.style.background = "var(--warn-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {replacing === docResult.documentId ? "Replacing..." : "Replace in this document"}
                </button>
              </div>
              <ul className="divide-y" style={{ borderColor: "var(--rule)" }}>
                {docResult.matches.slice(0, 20).map((match, idx) => (
                  <li key={idx} className="px-4 py-2 flex gap-3 text-sm" style={{ borderColor: "var(--rule)" }}>
                    <span
                      className="text-xs font-mono w-8 text-right shrink-0 pt-0.5"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      {match.lineNumber}
                    </span>
                    <span
                      className="break-all [&>mark]:bg-[#f2f9ff] [&>mark]:text-[#097fe8] [&>mark]:rounded-sm [&>mark]:px-0.5"
                      style={{ color: "var(--ink-2)" }}
                      dangerouslySetInnerHTML={{ __html: match.context }}
                    />
                  </li>
                ))}
                {docResult.matches.length > 20 && (
                  <li
                    className="px-4 py-2 text-xs italic"
                    style={{ color: "var(--ink-muted)" }}
                  >
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

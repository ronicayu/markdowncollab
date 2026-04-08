"use client";

import { useEffect, useState } from "react";

interface RelatedDoc {
  id: string;
  title: string;
  score: number;
}

interface RelatedDocsProps {
  documentId: string;
}

export default function RelatedDocs({ documentId }: RelatedDocsProps) {
  const [suggestions, setSuggestions] = useState<RelatedDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/agent/suggest-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId }),
    })
      .then((r) => (r.ok ? r.json() : { suggestions: [] }))
      .then((data) => setSuggestions(data.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [documentId]);

  if (!loading && suggestions.length === 0) return null;

  return (
    <div className="border-t border-gray-100 px-3 py-2">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1.5 w-full text-left text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors py-1"
      >
        <svg
          className={`h-3 w-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        Related Documents
      </button>
      {!collapsed && (
        <div className="mt-1 space-y-1">
          {loading ? (
            <p className="text-xs text-gray-400 py-1">Finding related docs...</p>
          ) : (
            suggestions.map((doc) => (
              <a
                key={doc.id}
                href={`/doc/${doc.id}`}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors group"
              >
                <svg className="h-3.5 w-3.5 text-gray-400 group-hover:text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.54a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.798" />
                </svg>
                <span className="truncate">{doc.title}</span>
                <span className="ml-auto text-[10px] text-gray-300 shrink-0">
                  {Math.round(doc.score * 100)}%
                </span>
              </a>
            ))
          )}
        </div>
      )}
    </div>
  );
}

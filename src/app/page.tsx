"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  async function createDoc() {
    setCreating(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      const doc = await res.json();
      router.push(`/doc/${doc.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#FBF7F0]">
      {/* Dark sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-[#1A1A2E] text-white shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <span className="text-base font-bold tracking-tight">MarkdownCollab</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {[
            { label: "All Documents", active: true },
            { label: "Recent" },
            { label: "Shared with me" },
          ].map(({ label, active }) => (
            <button
              key={label}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#0D9488] flex items-center justify-center text-xs font-bold shrink-0">
              N
            </div>
            <span className="text-sm text-white/70 truncate">My workspace</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#FBF7F0] border-b border-black/8 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">All Documents</h1>
          <button
            onClick={createDoc}
            disabled={creating}
            className="flex items-center gap-2 bg-[#0D9488] hover:bg-[#0f766e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            )}
            {creating ? "Creating..." : "New Document"}
          </button>
        </header>

        {/* Document list */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="space-y-2 max-w-3xl">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl px-5 py-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-gray-400 text-sm mb-4">No documents yet.</p>
              <button
                onClick={createDoc}
                className="bg-[#0D9488] hover:bg-[#0f766e] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create your first document
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl">
              {docs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/doc/${doc.id}`}
                  className="flex items-center justify-between bg-white rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-gray-200 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 rounded-full bg-[#0D9488] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {doc.title || "Untitled"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-4">
                    {formatDate(doc.updatedAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

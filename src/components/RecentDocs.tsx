"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface RecentDoc {
  id: string;
  title: string;
  openedAt: string;
}

const STORAGE_KEY = "recentDocs";
const MAX_RECENT = 5;

/** Read recent docs from localStorage. */
export function getRecentDocs(): RecentDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/** Track a document open — adds/updates the entry at the front. */
export function trackDocumentOpen(id: string, title: string): void {
  if (typeof window === "undefined") return;
  const existing = getRecentDocs().filter((d) => d.id !== id);
  const updated: RecentDoc[] = [
    { id, title, openedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, MAX_RECENT);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function RecentDocs() {
  const [docs, setDocs] = useState<RecentDoc[]>([]);
  const [collapsed, setCollapsed] = useState(true);
  const [now, setNow] = useState(Date.now());
  const router = useRouter();

  useEffect(() => {
    setDocs(getRecentDocs());
    // Listen for storage changes from other tabs or the document page
    const handleStorage = () => setDocs(getRecentDocs());
    window.addEventListener("storage", handleStorage);
    // Also listen for a custom event dispatched by the doc page within the same tab
    window.addEventListener("recentDocsUpdated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("recentDocsUpdated", handleStorage);
    };
  }, []);

  // Tick every 60s to update relative times
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (docs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 hidden md:block">
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#ffffff] text-[#31302e] border border-[rgba(0,0,0,0.1)] shadow-md hover:bg-[#f6f5f4] transition-colors"
          title="Recent documents"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      ) : (
        <div className="w-72 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-[#31302e] text-white">
            <span className="text-sm font-medium">Recent Documents</span>
            <button
              onClick={() => setCollapsed(true)}
              className="text-white/60 hover:text-white transition-colors"
              title="Collapse"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <ul className="divide-y divide-[rgba(0,0,0,0.1)]">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  onClick={() => {
                    router.push(`/doc/${doc.id}`);
                    setCollapsed(true);
                  }}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#f6f5f4] transition-colors"
                >
                  <p className="text-sm text-[#31302e] font-medium truncate">{doc.title || "Untitled"}</p>
                  <p className="text-[10px] text-[#a39e98] mt-0.5">{relativeTime(doc.openedAt)}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

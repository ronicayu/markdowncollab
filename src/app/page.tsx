"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";

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

type Tab = "all" | "recent" | "shared";

export default function Home() {
  const { data: session } = useSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  const filteredDocs = (() => {
    if (activeTab === "recent") {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // last 7 days
      return docs
        .filter((d) => new Date(d.updatedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (activeTab === "shared") {
      return []; // no sharing backend yet
    }
    return docs;
  })();

  const headingLabel: Record<Tab, string> = {
    all: "All Documents",
    recent: "Recent",
    shared: "Shared with me",
  };

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
    <div className="flex h-screen bg-[#F2E8D5]">
      {/* Dark sidebar */}
      <aside className="hidden md:flex w-56 flex-col bg-[#111110] text-white shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <span className="text-base font-bold tracking-tight">MarkdownCollab</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {(
            [
              { label: "All Documents", tab: "all" as Tab },
              { label: "Recent", tab: "recent" as Tab },
              { label: "Shared with me", tab: "shared" as Tab },
            ] as { label: string; tab: Tab }[]
          ).map(({ label, tab }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                activeTab === tab
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          {session ? (
            <div className="flex items-center gap-2">
              {session.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="h-7 w-7 rounded-full shrink-0" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-[#B8692A] flex items-center justify-center text-xs font-bold shrink-0">
                  {session.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{session.user?.name}</p>
                <button onClick={() => signOut()} className="text-xs text-white/40 hover:text-white/70 transition-colors">
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-white/20 text-sm text-white/70 hover:text-white hover:border-white/40 transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 bg-[#F2E8D5] border-b border-black/8 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">{headingLabel[activeTab]}</h1>
          <button
            onClick={createDoc}
            disabled={creating}
            className="flex items-center gap-2 bg-[#B8692A] hover:bg-[#96541F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div key={i} className="bg-[#FFFEF9] rounded-xl px-5 py-4 animate-pulse">
                  <div className="h-4 bg-amber-100 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-amber-50 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : activeTab === "shared" ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <p className="text-gray-400 text-sm">No documents have been shared with you yet.</p>
              <p className="text-gray-300 text-xs mt-1">Documents shared by collaborators will appear here.</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              {activeTab === "recent" ? (
                <p className="text-gray-400 text-sm">No documents updated in the last 7 days.</p>
              ) : (
                <>
                  <p className="text-gray-400 text-sm mb-4">No documents yet.</p>
                  <button
                    onClick={createDoc}
                    className="bg-[#B8692A] hover:bg-[#96541F] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Create your first document
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-w-3xl">
              {filteredDocs.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/doc/${doc.id}`}
                  className="flex items-center justify-between bg-[#FFFEF9] rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-amber-200 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 rounded-full bg-[#B8692A] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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

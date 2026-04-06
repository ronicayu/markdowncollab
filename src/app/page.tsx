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
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Tab = "all" | "recent";

export default function Home() {
  const { data: session } = useSession();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Doc | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  const filteredDocs = (() => {
    let result = docs;
    if (activeTab === "recent") {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = docs
        .filter((d) => new Date(d.updatedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) => (d.title || "Untitled").toLowerCase().includes(q));
    }
    if (sortBy === "name") {
      result = [...result].sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled"));
    } else {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return result;
  })();

  const headingLabel: Record<Tab, string> = {
    all: "All Documents",
    recent: "Recent",
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

  async function duplicateDoc(doc: Doc) {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `${doc.title || "Untitled"} (copy)` }),
    });
    const newDoc = await res.json();
    setDocs((prev) => [newDoc, ...prev]);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    setBulkDeleting(true);
    const ids = [...selected];
    await Promise.all(ids.map((id) => fetch(`/api/documents/${id}`, { method: "DELETE" })));
    setDocs((prev) => prev.filter((d) => !selected.has(d.id)));
    setSelected(new Set());
    setBulkDeleting(false);
  }

  async function deleteDoc(doc: Doc) {
    setDeletingId(doc.id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex h-screen bg-[#F2E8D5]">
      {/* Dark sidebar — desktop only */}
      <aside className="hidden md:flex w-56 flex-col bg-[#111110] text-white shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <span className="text-base font-bold tracking-tight">MarkdownCollab</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {(
            [
              { label: "All Documents", tab: "all" as Tab },
              { label: "Recent", tab: "recent" as Tab },
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
        {/* Mobile header — small screens only */}
        <div className="md:hidden bg-[#111110] text-white shrink-0">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-base font-bold tracking-tight">MarkdownCollab</span>
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
                <button onClick={() => signOut()} className="text-xs text-white/50 hover:text-white/70 transition-colors">
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => signIn()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/20 text-sm text-white/70 hover:text-white hover:border-white/40 transition-colors"
              >
                Sign in
              </button>
            )}
          </div>
          {/* Mobile tab bar */}
          <div className="flex px-2 pb-2 gap-1">
            {(
              [
                { label: "All", tab: "all" as Tab },
                { label: "Recent", tab: "recent" as Tab },
              ] as { label: string; tab: Tab }[]
            ).map(({ label, tab }) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-center px-2 py-2 rounded-md text-sm transition-colors ${
                  activeTab === tab
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-[#F2E8D5] border-b border-black/8 shrink-0">
          <h1 className="text-lg font-semibold text-gray-900 shrink-0">{headingLabel[activeTab]}</h1>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 rounded-lg border border-black/10 bg-white/60 px-3 py-1.5 text-sm outline-none placeholder:text-gray-400 focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
            />
            <button
              onClick={() => setSortBy(sortBy === "date" ? "name" : "date")}
              className="shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-lg border border-black/10 bg-white/60 text-xs text-gray-500 hover:text-gray-700 hover:border-black/20 transition-colors"
              title={`Sort by ${sortBy === "date" ? "name" : "date"}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h12M3 17h6" />
              </svg>
              <span className="hidden sm:inline">{sortBy === "date" ? "Date" : "Name"}</span>
            </button>
          </div>
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
            <span className="hidden sm:inline">{creating ? "Creating..." : "New Document"}</span>
            <span className="sm:hidden">{creating ? "..." : "New"}</span>
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
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              {search.trim() ? (
                <p className="text-gray-400 text-sm">No documents matching &ldquo;{search}&rdquo;</p>
              ) : activeTab === "recent" ? (
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
              {selected.size > 0 && (
                <div className="flex items-center gap-3 bg-[#111110] text-white rounded-xl px-4 py-3 mb-2">
                  <span className="text-sm">{selected.size} selected</span>
                  <button
                    onClick={bulkDelete}
                    disabled={bulkDeleting}
                    className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    {bulkDeleting ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-sm text-white/50 hover:text-white ml-auto"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {filteredDocs.map((doc) => (
                <div key={doc.id} className="relative group flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(doc.id)}
                    onChange={() => toggleSelect(doc.id)}
                    className="shrink-0 h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A] opacity-0 group-hover:opacity-100 transition-opacity checked:opacity-100 cursor-pointer"
                  />
                  <Link
                    href={`/doc/${doc.id}`}
                    className="flex-1 flex items-center justify-between bg-[#FFFEF9] rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-amber-200 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1 h-8 rounded-full bg-[#B8692A] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {doc.title || "Untitled"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-4 mr-16">
                      {formatDate(doc.updatedAt)}
                    </span>
                  </Link>
                  {/* Duplicate + Delete buttons — appear on hover */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); duplicateDoc(doc); }}
                      className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
                      title="Duplicate document"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); setConfirmDelete(doc); }}
                      disabled={deletingId === doc.id}
                      className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"
                      title="Delete document"
                    >
                      {deletingId === doc.id ? (
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Delete document?</h3>
            <p className="text-xs text-gray-500 mb-4">
              &ldquo;{confirmDelete.title || "Untitled"}&rdquo; will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteDoc(confirmDelete)}
                className="px-3 py-1.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import TemplatePicker from "@/components/TemplatePicker";
import NotificationBell from "@/components/NotificationBell";
import WelcomeModal from "@/components/WelcomeModal";

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  children: Folder[];
}

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
  deletedAt?: string | null;
  role?: string;
  ownerId?: string | null;
  starred?: boolean;
  folderId?: string | null;
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

type Tab = "all" | "recent" | "shared" | "starred" | "trash";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchResults, setSearchResults] = useState<{ id: string; title: string; snippet: string; updatedAt: string }[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [trashDocs, setTrashDocs] = useState<Doc[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<Doc | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [docTags, setDocTags] = useState<Record<string, Tag[]>>({});
  const [tagFilterId, setTagFilterId] = useState<string | null>(null);
  const [tagPopoverDocId, setTagPopoverDocId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameFolderName, setRenameFolderName] = useState("");
  const [analyticsDocId, setAnalyticsDocId] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    viewCount: number;
    editCount: number;
    collaboratorCount: number;
    createdAt: string;
    lastEditedAt: string;
  } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((fetchedDocs: Doc[]) => {
        setDocs(fetchedDocs);
        // Fetch tags for all documents
        fetchedDocs.forEach((doc) => {
          fetch(`/api/documents/${doc.id}/tags`)
            .then((r) => r.json())
            .then((tags: Tag[]) => {
              setDocTags((prev) => ({ ...prev, [doc.id]: tags }));
            })
            .catch(() => {});
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch all tags for the filter sidebar
  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then(setAllTags)
      .catch(() => {});
  }, []);

  // Fetch folders
  useEffect(() => {
    if (!session) return;
    fetch("/api/folders")
      .then((r) => r.json())
      .then((data: Folder[]) => { if (Array.isArray(data)) setFolders(data); })
      .catch(() => {});
  }, [session]);

  async function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      setNewFolderName("");
      setShowNewFolder(false);
      // Refresh folders
      const data = await fetch("/api/folders").then((r) => r.json());
      if (Array.isArray(data)) setFolders(data);
    }
  }

  async function renameFolder(folderId: string) {
    const name = renameFolderName.trim();
    if (!name) { setRenamingFolderId(null); return; }
    const res = await fetch(`/api/folders/${folderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setRenamingFolderId(null);
      const data = await fetch("/api/folders").then((r) => r.json());
      if (Array.isArray(data)) setFolders(data);
    }
  }

  async function deleteFolder(folderId: string) {
    const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
    if (res.ok) {
      if (currentFolderId === folderId) setCurrentFolderId(null);
      const data = await fetch("/api/folders").then((r) => r.json());
      if (Array.isArray(data)) setFolders(data);
      // Refresh docs since some may have moved to root
      fetch("/api/documents").then((r) => r.json()).then(setDocs);
    }
  }

  async function moveDocToFolder(docId: string, folderId: string | null) {
    await fetch(`/api/documents/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, folderId } : d));
  }

  function toggleFolderExpanded(folderId: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  }

  // Build breadcrumb path for current folder
  function getBreadcrumbs(): { id: string | null; name: string }[] {
    const crumbs: { id: string | null; name: string }[] = [{ id: null, name: "All Documents" }];
    if (!currentFolderId) return crumbs;

    function findPath(nodes: Folder[], targetId: string, path: Folder[]): Folder[] | null {
      for (const node of nodes) {
        const newPath = [...path, node];
        if (node.id === targetId) return newPath;
        const found = findPath(node.children, targetId, newPath);
        if (found) return found;
      }
      return null;
    }

    const path = findPath(folders, currentFolderId, []);
    if (path) {
      for (const f of path) crumbs.push({ id: f.id, name: f.name });
    }
    return crumbs;
  }

  // Fetch trash docs when the Trash tab is active
  useEffect(() => {
    if (activeTab !== "trash") return;
    setTrashLoading(true);
    fetch("/api/documents?trash=true")
      .then((r) => r.json())
      .then(setTrashDocs)
      .finally(() => setTrashLoading(false));
  }, [activeTab]);

  async function restoreDoc(doc: Doc) {
    await fetch(`/api/documents/${doc.id}/restore`, { method: "POST" });
    setTrashDocs((prev) => prev.filter((d) => d.id !== doc.id));
    // Refresh main docs list
    fetch("/api/documents").then((r) => r.json()).then(setDocs);
  }

  async function permanentDeleteDoc(doc: Doc) {
    setConfirmPermanentDelete(null);
    await fetch(`/api/documents/${doc.id}/permanent`, { method: "DELETE" });
    setTrashDocs((prev) => prev.filter((d) => d.id !== doc.id));
  }

  async function addTagToDoc(docId: string, tagId: string) {
    const res = await fetch(`/api/documents/${docId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    const tag = await res.json();
    if (tag && tag.id) {
      setDocTags((prev) => {
        const existing = prev[docId] || [];
        if (existing.some((t) => t.id === tag.id)) return prev;
        return { ...prev, [docId]: [...existing, tag] };
      });
    }
  }

  async function removeTagFromDoc(docId: string, tagId: string) {
    await fetch(`/api/documents/${docId}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId }),
    });
    setDocTags((prev) => ({
      ...prev,
      [docId]: (prev[docId] || []).filter((t) => t.id !== tagId),
    }));
  }

  async function createAndAddTag(docId: string, name: string) {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const tag = await res.json();
    if (tag && tag.id) {
      setAllTags((prev) => {
        if (prev.some((t) => t.id === tag.id)) return prev;
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name));
      });
      await addTagToDoc(docId, tag.id);
    }
    setNewTagName("");
  }

  // Debounced full-text search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(() => {
      fetch(`/api/documents/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setSearchResults(data);
          else setSearchResults([]);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  async function toggleStar(docId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/documents/${docId}/star`, { method: "POST" });
    const data = await res.json();
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, starred: data.starred } : d));
  }

  const filteredDocs = (() => {
    let result = docs;
    // Folder filter (only applies to "all" tab)
    if (activeTab === "all" && currentFolderId !== null) {
      result = result.filter((d) => d.folderId === currentFolderId);
    } else if (activeTab === "all" && currentFolderId === null) {
      // Show only root docs when in "All Documents" view (no folder selected means root)
      // But we show all docs by default when no folder is explicitly selected
    }
    if (activeTab === "starred") {
      result = docs.filter((d) => d.starred);
    } else if (activeTab === "recent") {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      result = docs
        .filter((d) => new Date(d.updatedAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (activeTab === "shared") {
      result = docs.filter((d) => d.role && d.role !== "owner" && d.ownerId !== null);
    }
    // Tag filter
    if (tagFilterId) {
      result = result.filter((d) => (docTags[d.id] || []).some((t) => t.id === tagFilterId));
    }
    if (search.trim() && !searchResults) {
      const q = search.toLowerCase();
      result = result.filter((d) => (d.title || "Untitled").toLowerCase().includes(q));
    }
    if (sortBy === "name") {
      result = [...result].sort((a, b) => (a.title || "Untitled").localeCompare(b.title || "Untitled"));
    } else {
      result = [...result].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    // Starred documents float to top (before the sort order within each group)
    if (activeTab !== "starred") {
      result = [...result].sort((a, b) => {
        if (a.starred && !b.starred) return -1;
        if (!a.starred && b.starred) return 1;
        return 0;
      });
    }
    return result;
  })();

  const headingLabel: Record<Tab, string> = {
    all: "All Documents",
    recent: "Recent",
    shared: "Shared with me",
    starred: "Starred",
    trash: "Trash",
  };

  async function createDocFromTemplate(templateId: string) {
    setCreating(true);
    setShowTemplatePicker(false);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          templateId: templateId === "blank" ? undefined : templateId,
        }),
      });
      const doc = await res.json();
      if (doc.templateContent) {
        sessionStorage.setItem(`template:${doc.id}`, doc.templateContent);
      }
      router.push(`/doc/${doc.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleImportMarkdown(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const title = file.name.replace(/\.md$/i, "") || "Imported Document";
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const doc = await res.json();
      sessionStorage.setItem(`template:${doc.id}`, text);
      router.push(`/doc/${doc.id}`);
    } finally {
      setImporting(false);
      // Reset input so re-importing the same file works
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function commitRename(docId: string) {
    const trimmed = editTitle.trim();
    setEditingId(null);
    if (!trimmed) return;
    await fetch(`/api/documents/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, title: trimmed } : d));
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
              { label: "Shared with me", tab: "shared" as Tab },
              { label: "Starred", tab: "starred" as Tab },
              { label: "Trash", tab: "trash" as Tab },
            ] as { label: string; tab: Tab }[]
          ).map(({ label, tab }) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); if (tab === "all") setCurrentFolderId(null); }}
              className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                activeTab === tab && !(tab === "all" && currentFolderId)
                  ? "bg-white/10 text-white font-medium"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {tab === "starred" && (
                <svg className="inline h-3.5 w-3.5 mr-1 -mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              )}
              {tab === "trash" && (
                <svg className="inline h-3.5 w-3.5 mr-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {label}
              {tab === "all" && docs.length > 0 && (
                <span className="ml-1.5 text-xs text-white/30">{docs.length}</span>
              )}
              {tab === "starred" && docs.filter((d) => d.starred).length > 0 && (
                <span className="ml-1.5 text-xs text-white/30">{docs.filter((d) => d.starred).length}</span>
              )}
            </button>
          ))}
        </nav>
        {/* Folders section */}
        {session && (
          <div className="px-3 py-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2 px-3">
              <p className="text-xs text-white/30 uppercase tracking-wider">Folders</p>
              <button
                onClick={() => { setShowNewFolder(true); setNewFolderName(""); }}
                className="text-white/30 hover:text-white transition-colors"
                title="New folder"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
            {showNewFolder && (
              <form
                className="flex items-center gap-1 px-3 mb-2"
                onSubmit={(e) => { e.preventDefault(); createFolder(); }}
              >
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  className="flex-1 min-w-0 rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-white outline-none focus:border-white/40"
                  onKeyDown={(e) => { if (e.key === "Escape") setShowNewFolder(false); }}
                />
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-2 py-1 rounded bg-white/10 text-white text-xs font-medium disabled:opacity-40 hover:bg-white/20"
                >
                  Add
                </button>
              </form>
            )}
            <div className="space-y-0.5">
              {(function renderFolderTree(nodes: Folder[], depth: number): React.ReactNode[] {
                return nodes.map((folder) => (
                  <div key={folder.id}>
                    <div
                      className={`group/folder flex items-center gap-1 w-full text-left rounded-md text-sm transition-colors ${
                        currentFolderId === folder.id
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                      style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
                    >
                      {folder.children.length > 0 ? (
                        <button
                          onClick={() => toggleFolderExpanded(folder.id)}
                          className="p-0.5 shrink-0"
                        >
                          <svg
                            className={`h-3 w-3 transition-transform ${expandedFolders.has(folder.id) ? "rotate-90" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {renamingFolderId === folder.id ? (
                        <input
                          autoFocus
                          value={renameFolderName}
                          onChange={(e) => setRenameFolderName(e.target.value)}
                          onBlur={() => renameFolder(folder.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameFolder(folder.id);
                            if (e.key === "Escape") setRenamingFolderId(null);
                          }}
                          className="flex-1 min-w-0 rounded bg-white/10 px-1 py-0.5 text-xs text-white outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setCurrentFolderId(folder.id);
                            setActiveTab("all");
                            if (folder.children.length > 0) setExpandedFolders((prev) => new Set(prev).add(folder.id));
                          }}
                          onDoubleClick={() => {
                            setRenamingFolderId(folder.id);
                            setRenameFolderName(folder.name);
                          }}
                          className="flex-1 min-w-0 text-left py-2 truncate"
                        >
                          {folder.name}
                        </button>
                      )}
                      <button
                        onClick={() => deleteFolder(folder.id)}
                        className="p-1 shrink-0 opacity-0 group-hover/folder:opacity-100 text-white/30 hover:text-red-400 transition-all"
                        title="Delete folder"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {expandedFolders.has(folder.id) && folder.children.length > 0 && (
                      <div>{renderFolderTree(folder.children, depth + 1)}</div>
                    )}
                  </div>
                ));
              })(folders, 0)}
            </div>
          </div>
        )}
        {allTags.length > 0 && (
          <div className="px-3 py-3 border-t border-white/10">
            <p className="text-xs text-white/30 uppercase tracking-wider mb-2 px-3">Tags</p>
            <div className="space-y-0.5">
              <button
                onClick={() => setTagFilterId(null)}
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  !tagFilterId ? "bg-white/10 text-white font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                All tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setTagFilterId(tagFilterId === tag.id ? null : tag.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                    tagFilterId === tag.id ? "bg-white/10 text-white font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
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
                <NotificationBell />
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
                { label: "Shared", tab: "shared" as Tab },
                { label: "Starred", tab: "starred" as Tab },
                { label: "Trash", tab: "trash" as Tab },
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
          <div className="shrink-0">
            {activeTab === "all" && currentFolderId ? (
              <nav className="flex items-center gap-1 text-sm">
                {getBreadcrumbs().map((crumb, i, arr) => (
                  <span key={crumb.id ?? "root"} className="flex items-center gap-1">
                    {i > 0 && <span className="text-gray-400">/</span>}
                    {i === arr.length - 1 ? (
                      <span className="font-semibold text-gray-900">{crumb.name}</span>
                    ) : (
                      <button
                        onClick={() => setCurrentFolderId(crumb.id)}
                        className="text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                ))}
              </nav>
            ) : (
              <h1 className="text-lg font-semibold text-gray-900">{headingLabel[activeTab]}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <input
              type="text"
              placeholder="Search titles and content..."
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
          {session && <NotificationBell />}
          <input
            ref={importInputRef}
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleImportMarkdown}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 border border-[#B8692A]/30 text-[#B8692A] hover:bg-amber-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            <span className="hidden sm:inline">{importing ? "Importing..." : "Import"}</span>
          </button>
          <button
            onClick={() => setShowTemplatePicker(true)}
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
          {/* Full-text search results overlay */}
          {searchResults !== null ? (
            <div className="space-y-2 max-w-3xl">
              {searchLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <p className="text-gray-400 text-sm">No results for &ldquo;{search}&rdquo; in titles or content.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;</p>
                  {searchResults.map((result) => (
                    <Link
                      key={result.id}
                      href={`/doc/${result.id}`}
                      className="block bg-[#FFFEF9] rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-amber-200 transition-all"
                    >
                      <p className="font-medium text-gray-900">{result.title || "Untitled"}</p>
                      {result.snippet && (
                        <p
                          className="text-xs text-gray-500 mt-1 line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: result.snippet }}
                        />
                      )}
                      <span className="text-xs text-gray-400 mt-1 block">{formatDate(result.updatedAt)}</span>
                    </Link>
                  ))}
                </>
              )}
            </div>
          ) : activeTab === "trash" ? (
            <div className="space-y-2 max-w-3xl">
              {trashLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-8 justify-center">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              ) : trashDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <p className="text-gray-400 text-sm">Trash is empty.</p>
                </div>
              ) : (
                trashDocs.map((doc) => {
                  const deletedDaysAgo = doc.deletedAt
                    ? Math.floor((Date.now() - new Date(doc.deletedAt).getTime()) / 86400000)
                    : 0;
                  return (
                    <div key={doc.id} className="flex items-center justify-between bg-[#FFFEF9] rounded-xl px-5 py-4 border border-transparent">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-500 truncate">{doc.title || "Untitled"}</p>
                        <p className="text-xs text-gray-400">
                          Deleted {deletedDaysAgo === 0 ? "today" : deletedDaysAgo === 1 ? "yesterday" : `${deletedDaysAgo}d ago`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <button
                          onClick={() => restoreDoc(doc)}
                          className="px-3 py-1.5 text-xs font-medium text-[#B8692A] border border-[#B8692A]/30 rounded-lg hover:bg-amber-50 transition-colors"
                        >
                          Restore
                        </button>
                        <button
                          onClick={() => setConfirmPermanentDelete(doc)}
                          className="px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Delete permanently
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : loading ? (
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
                    onClick={() => setShowTemplatePicker(true)}
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
                    className="shrink-0 h-4 w-4 rounded border-gray-300 text-[#B8692A] focus:ring-[#B8692A] md:opacity-0 md:group-hover:opacity-100 transition-opacity checked:!opacity-100 cursor-pointer"
                  />
                  <button
                    onClick={(e) => toggleStar(doc.id, e)}
                    className={`shrink-0 p-0.5 rounded transition-colors ${
                      doc.starred
                        ? "text-amber-500"
                        : "text-gray-300 hover:text-amber-400 md:opacity-0 md:group-hover:opacity-100"
                    }`}
                    title={doc.starred ? "Unstar document" : "Star document"}
                  >
                    <svg className="h-4 w-4" fill={doc.starred ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                  <Link
                    href={`/doc/${doc.id}`}
                    className="flex-1 flex items-center justify-between bg-[#FFFEF9] rounded-xl px-5 py-4 hover:shadow-sm border border-transparent hover:border-amber-200 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1 h-8 rounded-full bg-[#B8692A] md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0" />
                      <div className="min-w-0">
                        {editingId === doc.id ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => commitRename(doc.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            onClick={(e) => e.preventDefault()}
                            className="font-medium text-gray-900 bg-white border border-[#B8692A] rounded px-1.5 py-0.5 outline-none w-full"
                          />
                        ) : (
                          <>
                          <p
                            className="font-medium text-gray-900 truncate"
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              setEditingId(doc.id);
                              setEditTitle(doc.title || "Untitled");
                            }}
                          >
                            {doc.title || "Untitled"}
                          </p>
                          {doc.role && doc.role !== "owner" && doc.ownerId && (
                            <span className={`inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                              doc.role === "editor"
                                ? "bg-blue-50 text-blue-600"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              {doc.role === "editor" ? "Editor" : "Viewer"}
                            </span>
                          )}
                          {(docTags[doc.id] || []).length > 0 && (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {(docTags[doc.id] || []).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium text-white"
                                  style={{ backgroundColor: tag.color }}
                                >
                                  {tag.name}
                                  <button
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeTagFromDoc(doc.id, tag.id); }}
                                    className="hover:opacity-70 ml-0.5"
                                  >
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 ml-4 mr-16">
                      {formatDate(doc.updatedAt)}
                    </span>
                  </Link>
                  {/* Tag popover */}
                  {tagPopoverDocId === doc.id && (
                    <div
                      className="absolute right-3 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700">Add tag</p>
                        <button onClick={() => setTagPopoverDocId(null)} className="text-gray-400 hover:text-gray-600 text-xs">
                          x
                        </button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                        {allTags.map((tag) => {
                          const isApplied = (docTags[doc.id] || []).some((t) => t.id === tag.id);
                          return (
                            <button
                              key={tag.id}
                              onClick={() => isApplied ? removeTagFromDoc(doc.id, tag.id) : addTagToDoc(doc.id, tag.id)}
                              className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-sm transition-colors ${
                                isApplied ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                              <span className="truncate text-gray-700">{tag.name}</span>
                              {isApplied && <span className="ml-auto text-xs text-gray-400">&#10003;</span>}
                            </button>
                          );
                        })}
                      </div>
                      <form
                        onSubmit={(e) => { e.preventDefault(); if (newTagName.trim()) createAndAddTag(doc.id, newTagName.trim()); }}
                        className="flex items-center gap-1"
                      >
                        <input
                          type="text"
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="New tag..."
                          className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-[#B8692A]"
                        />
                        <button
                          type="submit"
                          disabled={!newTagName.trim()}
                          className="px-2 py-1 rounded bg-[#B8692A] text-white text-xs font-medium disabled:opacity-40"
                        >
                          Add
                        </button>
                      </form>
                    </div>
                  )}
                  {/* Analytics popover */}
                  {analyticsDocId === doc.id && analyticsData && (
                    <div
                      className="absolute right-3 top-full mt-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-56"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700">Analytics</p>
                        <button onClick={() => setAnalyticsDocId(null)} className="text-gray-400 hover:text-gray-600 text-xs">x</button>
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-600">
                        <div className="flex justify-between"><span>Views</span><span className="font-medium text-gray-900">{analyticsData.viewCount}</span></div>
                        <div className="flex justify-between"><span>Activity events</span><span className="font-medium text-gray-900">{analyticsData.editCount}</span></div>
                        <div className="flex justify-between"><span>Collaborators</span><span className="font-medium text-gray-900">{analyticsData.collaboratorCount}</span></div>
                        <div className="flex justify-between"><span>Created</span><span className="font-medium text-gray-900">{formatDate(analyticsData.createdAt)}</span></div>
                        <div className="flex justify-between"><span>Last edited</span><span className="font-medium text-gray-900">{formatDate(analyticsData.lastEditedAt)}</span></div>
                      </div>
                    </div>
                  )}
                  {/* Analytics + Tag + Duplicate + Delete buttons — appear on hover */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (analyticsDocId === doc.id) {
                          setAnalyticsDocId(null);
                          return;
                        }
                        setAnalyticsDocId(doc.id);
                        setAnalyticsLoading(true);
                        fetch(`/api/documents/${doc.id}/analytics`)
                          .then((r) => r.ok ? r.json() : null)
                          .then((data) => { if (data) setAnalyticsData(data); })
                          .catch(() => {})
                          .finally(() => setAnalyticsLoading(false));
                      }}
                      className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
                      title="View analytics"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTagPopoverDocId(tagPopoverDocId === doc.id ? null : doc.id); setNewTagName(""); }}
                      className="p-1.5 rounded-md text-gray-300 hover:text-[#B8692A] hover:bg-amber-50"
                      title="Manage tags"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </button>
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

      <TemplatePicker
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={createDocFromTemplate}
      />

      <WelcomeModal />

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
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Move to trash?</h3>
            <p className="text-xs text-gray-500 mb-4">
              &ldquo;{confirmDelete.title || "Untitled"}&rdquo; will be moved to trash. You can restore it later.
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

      {/* Permanent delete confirmation modal */}
      {confirmPermanentDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          onClick={() => setConfirmPermanentDelete(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Permanently delete?</h3>
            <p className="text-xs text-gray-500 mb-4">
              &ldquo;{confirmPermanentDelete.title || "Untitled"}&rdquo; will be permanently deleted. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmPermanentDelete(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => permanentDeleteDoc(confirmPermanentDelete)}
                className="px-3 py-1.5 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

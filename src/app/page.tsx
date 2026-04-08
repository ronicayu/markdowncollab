"use client";

import Link from "next/link";
import { useEffect, useState, useRef, useCallback, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import TemplatePicker from "@/components/TemplatePicker";
import NotificationBell from "@/components/NotificationBell";
import WelcomeModal from "@/components/WelcomeModal";
import DuplicateDialog from "@/components/DuplicateDialog";
import TemplateVariableDialog from "@/components/TemplateVariableDialog";
import DocumentRow from "@/components/dashboard/DocumentRow";
import BulkActionsBar from "@/components/dashboard/BulkActionsBar";
import SearchBar, { SearchFiltersRow } from "@/components/dashboard/SearchBar";
import { useTranslation } from "@/lib/i18n";
import { templates, extractCustomVariables } from "@/lib/templates";

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
  status?: string;
}

function formatDateRelative(dateStr: string) {
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

function formatDateAbsolute(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type Tab = "all" | "recent" | "shared" | "starred" | "trash";

export default function Home() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Doc | null>(null);
  const [search, setSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<"date" | "name">("date");
  const [relativeDates, setRelativeDates] = useState(true);
  const formatDate = useCallback(
    (dateStr: string) => relativeDates ? formatDateRelative(dateStr) : formatDateAbsolute(dateStr),
    [relativeDates]
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);
  const [pendingTemplateVars, setPendingTemplateVars] = useState<string[]>([]);
  const [pendingTemplateName, setPendingTemplateName] = useState("");
  const [duplicateDialogDoc, setDuplicateDialogDoc] = useState<Doc | null>(null);
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
  const [newTagColor, setNewTagColor] = useState("#6b7280");
  const TAG_PRESET_COLORS = [
    { label: "Gray", value: "#6b7280" },
    { label: "Red", value: "#ef4444" },
    { label: "Amber", value: "#f59e0b" },
    { label: "Green", value: "#22c55e" },
    { label: "Blue", value: "#3b82f6" },
    { label: "Purple", value: "#a855f7" },
  ];
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
  const [searchTagFilter, setSearchTagFilter] = useState("");
  const [searchFolderFilter, setSearchFolderFilter] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dueReminders, setDueReminders] = useState<{ id: string; documentId: string; remindAt: string; message: string; docTitle: string }[]>([]);
  const [docRatings, setDocRatings] = useState<Record<string, number>>({});
  const [showBulkTagPopover, setShowBulkTagPopover] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [docReactions, setDocReactions] = useState<Record<string, Array<{ emoji: string; count: number; userIds: string[] }>>>({});
  const [reactionPickerDocId, setReactionPickerDocId] = useState<string | null>(null);
  const [bulkTagging, setBulkTagging] = useState(false);
  const [merging, setMerging] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const [bulkShareEmail, setBulkShareEmail] = useState("");
  const [bulkShareRole, setBulkShareRole] = useState<"viewer" | "editor">("viewer");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Hydrate localStorage-backed state on the client to avoid SSR mismatch
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("recentSearches") || "[]"); if (Array.isArray(saved)) setRecentSearches(saved); } catch {}
    try { if (localStorage.getItem("relativeDates") === "false") setRelativeDates(false); } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => {
        if (!r.ok) return [];
        return r.json().catch(() => []);
      })
      .then((fetchedDocs: Doc[]) => {
        if (!fetchedDocs || !Array.isArray(fetchedDocs)) return;
        setDocs(fetchedDocs);
        // Fetch ratings for all documents
        fetchedDocs.forEach((doc) => {
          fetch(`/api/documents/${doc.id}/ratings`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.average) {
                setDocRatings((prev) => ({ ...prev, [doc.id]: data.average }));
              }
            })
            .catch(() => {});
        });
        // Fetch reactions for all documents
        fetchedDocs.forEach((doc) => {
          fetch(`/api/documents/${doc.id}/reactions`)
            .then((r) => (r.ok ? r.json() : []))
            .then((reactions: Array<{ emoji: string; count: number; userIds: string[] }>) => {
              if (reactions.length > 0) {
                setDocReactions((prev) => ({ ...prev, [doc.id]: reactions }));
              }
            })
            .catch(() => {});
        });
        // Fetch tags for all documents
        fetchedDocs.forEach((doc) => {
          fetch(`/api/documents/${doc.id}/tags`)
            .then((r) => r.ok ? r.json() : null)
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
      .then((r) => r.ok ? r.json() : null)
      .then(setAllTags)
      .catch(() => {});
  }, []);

  // Check for due reminders on mount
  useEffect(() => {
    if (!session) return;
    fetch("/api/reminders")
      .then((r) => (r.ok ? r.json() : []))
      .then((reminders: { id: string; documentId: string; remindAt: string; message: string }[]) => {
        const now = new Date();
        const due = reminders.filter((r) => new Date(r.remindAt) <= now);
        due.forEach((rem) => {
          const docTitle = docs.find((d) => d.id === rem.documentId)?.title || "a document";
          setDueReminders((prev) => [...prev, { ...rem, docTitle }]);
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Fetch folders
  useEffect(() => {
    if (!session) return;
    fetch("/api/folders")
      .then((r) => r.ok ? r.json() : null)
      .then((data: Folder[]) => { if (Array.isArray(data)) setFolders(data); })
      .catch(() => {});
  }, [session]);

  // Fetch pinned document IDs
  useEffect(() => {
    if (!session) return;
    fetch("/api/pins")
      .then((r) => r.ok ? r.json() : [])
      .then((pins: { documentId: string }[]) => {
        setPinnedIds(new Set(pins.map((p) => p.documentId)));
      })
      .catch(() => {});
  }, [session]);

  async function togglePin(docId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const res = await fetch(`/api/documents/${docId}/pin`, { method: "POST" });
    if (!res.ok) return;
    const { pinned } = await res.json();
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (pinned) next.add(docId); else next.delete(docId);
      return next;
    });
  }

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
      const data = await fetch("/api/folders").then((r) => r.ok ? r.json() : null);
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
      const data = await fetch("/api/folders").then((r) => r.ok ? r.json() : null);
      if (Array.isArray(data)) setFolders(data);
    }
  }

  async function deleteFolder(folderId: string) {
    const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
    if (res.ok) {
      if (currentFolderId === folderId) setCurrentFolderId(null);
      const data = await fetch("/api/folders").then((r) => r.ok ? r.json() : null);
      if (Array.isArray(data)) setFolders(data);
      // Refresh docs since some may have moved to root
      fetch("/api/documents").then((r) => r.ok ? r.json() : null).then(setDocs);
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
      .then((r) => r.ok ? r.json() : null)
      .then(setTrashDocs)
      .finally(() => setTrashLoading(false));
  }, [activeTab]);

  async function restoreDoc(doc: Doc) {
    await fetch(`/api/documents/${doc.id}/restore`, { method: "POST" });
    setTrashDocs((prev) => prev.filter((d) => d.id !== doc.id));
    // Refresh main docs list
    fetch("/api/documents").then((r) => r.ok ? r.json() : null).then(setDocs);
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

  async function createAndAddTag(docId: string, name: string, color?: string) {
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color: color || newTagColor }),
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
    setNewTagColor("#6b7280");
  }

  // Debounced full-text search with filters
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    // Save to recent searches
    setRecentSearches((prev) => {
      const updated = [q, ...prev.filter((s) => s !== q)].slice(0, 5);
      try { localStorage.setItem("recentSearches", JSON.stringify(updated)); } catch {}
      return updated;
    });
    searchTimerRef.current = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (searchTagFilter) params.set("tag", searchTagFilter);
      if (searchFolderFilter) params.set("folderId", searchFolderFilter);
      if (searchDateFrom) params.set("dateFrom", searchDateFrom);
      if (searchDateTo) params.set("dateTo", searchDateTo);
      fetch(`/api/documents/search?${params.toString()}`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data && data.items) setSearchResults(data.items);
          else if (Array.isArray(data)) setSearchResults(data);
          else setSearchResults([]);
        })
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, searchTagFilter, searchFolderFilter, searchDateFrom, searchDateTo]);

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
    // Pinned documents float to top
    result = [...result].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 1 : 0;
      const bp = pinnedIds.has(b.id) ? 1 : 0;
      return bp - ap;
    });
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

  async function createDocFromTemplate(templateId: string, templateVariables?: Record<string, string>) {
    setCreating(true);
    setShowTemplatePicker(false);

    // Check for custom variables if not already provided
    if (!templateVariables && templateId !== "blank") {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        const customVars = extractCustomVariables(template.content);
        if (customVars.length > 0) {
          setCreating(false);
          setPendingTemplateId(templateId);
          setPendingTemplateVars(customVars);
          setPendingTemplateName(template.name);
          return;
        }
      }
    }

    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled",
          templateId: templateId === "blank" ? undefined : templateId,
          templateVariables,
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

  function handleTemplateVariableConfirm(values: Record<string, string>) {
    if (pendingTemplateId) {
      const tid = pendingTemplateId;
      setPendingTemplateId(null);
      setPendingTemplateVars([]);
      setPendingTemplateName("");
      createDocFromTemplate(tid, values);
    }
  }

  function handleTemplateVariableCancel() {
    setPendingTemplateId(null);
    setPendingTemplateVars([]);
    setPendingTemplateName("");
  }

  async function handleImportMarkdown(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/import", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Import failed");
        return;
      }
      const { id, format, content } = await res.json();
      sessionStorage.setItem(`import:${id}`, JSON.stringify({ format, content }));
      router.push(`/doc/${id}`);
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

  async function toggleReaction(docId: string, emoji: string) {
    try {
      const res = await fetch(`/api/documents/${docId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        // Refetch reactions for this doc
        const reactionsRes = await fetch(`/api/documents/${docId}/reactions`);
        if (reactionsRes.ok) {
          const reactions = await reactionsRes.json();
          setDocReactions((prev) => ({ ...prev, [docId]: reactions }));
        }
      }
    } catch {}
  }

  function duplicateDoc(doc: Doc) {
    setDuplicateDialogDoc(doc);
  }

  async function forkDoc(doc: Doc) {
    const res = await fetch(`/api/documents/${doc.id}/fork`, { method: "POST" });
    if (!res.ok) return;
    const forked = await res.json();
    router.push(`/doc/${forked.id}`);
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

  async function bulkAddTag(tagId: string) {
    setBulkTagging(true);
    const ids = [...selected];
    await Promise.all(
      ids.map((docId) =>
        fetch(`/api/documents/${docId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        })
          .then((r) => r.ok ? r.json() : null)
          .then((tag) => {
            if (tag && tag.id) {
              setDocTags((prev) => {
                const existing = prev[docId] || [];
                if (existing.some((t) => t.id === tag.id)) return prev;
                return { ...prev, [docId]: [...existing, tag] };
              });
            }
          })
          .catch(() => {})
      )
    );
    setBulkTagging(false);
  }

  async function bulkRemoveTag(tagId: string) {
    setBulkTagging(true);
    const ids = [...selected];
    await Promise.all(
      ids.map((docId) =>
        fetch(`/api/documents/${docId}/tags`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId }),
        })
          .then(() => {
            setDocTags((prev) => ({
              ...prev,
              [docId]: (prev[docId] || []).filter((t) => t.id !== tagId),
            }));
          })
          .catch(() => {})
      )
    );
    setBulkTagging(false);
  }

  async function bulkMoveToFolder(folderId: string | null) {
    const ids = [...selected];
    await fetch("/api/documents/bulk/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids, folderId }),
    });
    setDocs((prev) =>
      prev.map((d) => (selected.has(d.id) ? { ...d, folderId: folderId } : d))
    );
    setSelected(new Set());
    setBulkMoveOpen(false);
  }

  async function bulkShare() {
    if (!bulkShareEmail.trim()) return;
    const ids = [...selected];
    await fetch("/api/documents/bulk/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentIds: ids, email: bulkShareEmail, role: bulkShareRole }),
    });
    setBulkShareEmail("");
    setBulkShareRole("viewer");
    setBulkShareOpen(false);
  }

  async function mergeDocuments() {
    if (selected.size !== 2) return;
    const ids = [...selected];
    const targetId = ids[0];
    const sourceId = ids[1];
    const targetDoc = docs.find((d) => d.id === targetId);
    const sourceDoc = docs.find((d) => d.id === sourceId);
    if (!confirm(`Merge "${sourceDoc?.title || "Untitled"}" into "${targetDoc?.title || "Untitled"}"? A new combined document will be created.`)) return;
    setMerging(true);
    try {
      const res = await fetch("/api/documents/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId, mode: "append" }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Merge failed");
        return;
      }
      const data = await res.json();
      // Store merged content so the editor can initialize the Yjs doc with it
      if (data.mergedContent) {
        sessionStorage.setItem(`template:${data.id}`, data.mergedContent);
      }
      setSelected(new Set());
      router.push(`/doc/${data.id}`);
    } catch {
      alert("Merge failed");
    } finally {
      setMerging(false);
    }
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
              { label: t("tab.all"), tab: "all" as Tab },
              { label: t("tab.recent"), tab: "recent" as Tab },
              { label: t("tab.shared"), tab: "shared" as Tab },
              { label: t("tab.starred"), tab: "starred" as Tab },
              { label: t("tab.trash"), tab: "trash" as Tab },
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
        {/* Statistics link */}
        <div className="px-3 pb-1">
          <Link
            href="/stats"
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            Statistics
          </Link>
          <Link
            href="/board"
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
            </svg>
            Board
          </Link>
          <Link
            href="/graph"
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
            Graph
          </Link>
          <Link
            href="/search-replace"
            className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
            Search &amp; Replace
          </Link>
        </div>
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
                        dragOverFolderId === folder.id
                          ? "bg-amber-500/20 text-white ring-1 ring-amber-400/50"
                          : currentFolderId === folder.id
                          ? "bg-white/10 text-white font-medium"
                          : "text-white/50 hover:text-white hover:bg-white/5"
                      }`}
                      style={{ paddingLeft: `${0.75 + depth * 0.75}rem` }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={() => setDragOverFolderId(null)}
                      onDrop={async (e) => {
                        e.preventDefault();
                        setDragOverFolderId(null);
                        const docId = e.dataTransfer.getData("text/plain");
                        if (docId) {
                          await moveDocToFolder(docId, folder.id);
                        }
                      }}
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
        <div className="px-3 py-2 border-t border-white/10">
          <a
            href="/api/documents/export?all=true"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export all (ZIP)
          </a>
        </div>
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

        {/* Due reminders banner */}
        {dueReminders.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-2 flex flex-col gap-1">
            {dueReminders.map((rem) => (
              <div key={rem.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 text-amber-800">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>
                    Reminder: {rem.message || "Check this document"} &mdash;{" "}
                    <Link href={`/doc/${rem.documentId}`} className="font-medium underline hover:text-amber-900">
                      {rem.docTitle}
                    </Link>
                  </span>
                </div>
                <button
                  onClick={() => {
                    fetch(`/api/reminders?id=${rem.id}`, { method: "DELETE" });
                    setDueReminders((prev) => prev.filter((r) => r.id !== rem.id));
                  }}
                  className="text-amber-600 hover:text-amber-800 text-xs font-medium shrink-0"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}

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
          <SearchBar
            search={search}
            onSearchChange={setSearch}
            searchInputRef={searchInputRef}
            showRecentSearches={showRecentSearches}
            onSetShowRecentSearches={setShowRecentSearches}
            recentSearches={recentSearches}
            onSetRecentSearches={setRecentSearches}
            sortBy={sortBy}
            onSetSortBy={setSortBy}
            relativeDates={relativeDates}
            onSetRelativeDates={setRelativeDates}
            showSearchFilters={showSearchFilters}
            onSetShowSearchFilters={(v) => setShowSearchFilters(v)}
            searchTagFilter={searchTagFilter}
            onSetSearchTagFilter={setSearchTagFilter}
            searchFolderFilter={searchFolderFilter}
            onSetSearchFolderFilter={setSearchFolderFilter}
            searchDateFrom={searchDateFrom}
            onSetSearchDateFrom={setSearchDateFrom}
            searchDateTo={searchDateTo}
            onSetSearchDateTo={setSearchDateTo}
            allTags={allTags}
            folders={folders}
          />
          {session && <NotificationBell />}
          <input
            ref={importInputRef}
            type="file"
            accept=".md,.docx,.html,.htm,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/html"
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

        {/* Search filters row */}
        <SearchFiltersRow
          showSearchFilters={showSearchFilters}
          searchTagFilter={searchTagFilter}
          onSetSearchTagFilter={setSearchTagFilter}
          searchFolderFilter={searchFolderFilter}
          onSetSearchFolderFilter={setSearchFolderFilter}
          searchDateFrom={searchDateFrom}
          onSetSearchDateFrom={setSearchDateFrom}
          searchDateTo={searchDateTo}
          onSetSearchDateTo={setSearchDateTo}
          allTags={allTags}
          folders={folders}
        />

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
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <span className="text-4xl mb-3">&#128269;</span>
                  <p className="text-sm">No results for &ldquo;{search}&rdquo;. Try a different search term.</p>
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
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <span className="text-4xl mb-3">&#128465;</span>
                  <p className="text-sm">Trash is empty.</p>
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
            <div className="space-y-3 p-4 max-w-3xl">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-gray-100">
                  <div className="w-4 h-4 bg-gray-200 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              {search.trim() ? (
                <>
                  <span className="text-4xl mb-3">&#128269;</span>
                  <p className="text-sm">No results for &ldquo;{search}&rdquo;. Try a different search term.</p>
                </>
              ) : activeTab === "starred" ? (
                <>
                  <span className="text-4xl mb-3">&#11088;</span>
                  <p className="text-sm">No starred documents yet. Star a document to find it quickly here.</p>
                </>
              ) : activeTab === "shared" ? (
                <>
                  <span className="text-4xl mb-3">&#128101;</span>
                  <p className="text-sm">No documents shared with you yet.</p>
                </>
              ) : activeTab === "recent" ? (
                <>
                  <span className="text-4xl mb-3">&#128337;</span>
                  <p className="text-sm">No documents updated in the last 7 days.</p>
                </>
              ) : (
                <>
                  <span className="text-4xl mb-3">&#128196;</span>
                  <p className="text-sm mb-4">No documents yet.</p>
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
            <div
              className="space-y-2 max-w-3xl"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setFocusedIndex((prev) => Math.min(prev + 1, filteredDocs.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setFocusedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === "Enter" && focusedIndex >= 0 && focusedIndex < filteredDocs.length) {
                  e.preventDefault();
                  router.push(`/doc/${filteredDocs[focusedIndex].id}`);
                } else if (e.key === "Escape") {
                  setFocusedIndex(-1);
                }
              }}
            >
              {selected.size > 0 && (
                <BulkActionsBar
                  selectedCount={selected.size}
                  selected={selected}
                  bulkDeleting={bulkDeleting}
                  bulkTagging={bulkTagging}
                  merging={merging}
                  showBulkTagPopover={showBulkTagPopover}
                  bulkMoveOpen={bulkMoveOpen}
                  bulkShareOpen={bulkShareOpen}
                  bulkShareEmail={bulkShareEmail}
                  bulkShareRole={bulkShareRole}
                  allTags={allTags}
                  docTags={docTags}
                  folders={folders}
                  newTagName={newTagName}
                  newTagColor={newTagColor}
                  TAG_PRESET_COLORS={TAG_PRESET_COLORS}
                  onBulkDelete={bulkDelete}
                  onBulkAddTag={bulkAddTag}
                  onBulkRemoveTag={bulkRemoveTag}
                  onBulkMoveToFolder={bulkMoveToFolder}
                  onBulkShare={bulkShare}
                  onMergeDocuments={mergeDocuments}
                  onSetShowBulkTagPopover={setShowBulkTagPopover}
                  onSetBulkMoveOpen={setBulkMoveOpen}
                  onSetBulkShareOpen={setBulkShareOpen}
                  onSetBulkShareEmail={setBulkShareEmail}
                  onSetBulkShareRole={setBulkShareRole}
                  onSetNewTagName={setNewTagName}
                  onSetNewTagColor={setNewTagColor}
                  onSetAllTags={setAllTags}
                  onCancel={() => { setSelected(new Set()); setShowBulkTagPopover(false); setBulkMoveOpen(false); setBulkShareOpen(false); }}
                />
              )}
              {filteredDocs.map((doc, index) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  index={index}
                  focusedIndex={focusedIndex}
                  formatDate={formatDate}
                  selected={selected.has(doc.id)}
                  onToggleSelect={toggleSelect}
                  onToggleStar={toggleStar}
                  onTogglePin={togglePin}
                  pinnedIds={pinnedIds}
                  editingId={editingId}
                  editTitle={editTitle}
                  onSetEditingId={setEditingId}
                  onSetEditTitle={setEditTitle}
                  onCommitRename={commitRename}
                  docTags={docTags[doc.id] || []}
                  onRemoveTagFromDoc={removeTagFromDoc}
                  docReactions={docReactions[doc.id] || []}
                  onToggleReaction={toggleReaction}
                  reactionPickerDocId={reactionPickerDocId}
                  onSetReactionPickerDocId={setReactionPickerDocId}
                  docRating={docRatings[doc.id]}
                  deletingId={deletingId}
                  onConfirmDelete={setConfirmDelete}
                  onDuplicateDoc={duplicateDoc}
                  onForkDoc={forkDoc}
                  tagPopoverDocId={tagPopoverDocId}
                  onSetTagPopoverDocId={setTagPopoverDocId}
                  allTags={allTags}
                  onAddTagToDoc={addTagToDoc}
                  newTagName={newTagName}
                  onSetNewTagName={setNewTagName}
                  newTagColor={newTagColor}
                  onSetNewTagColor={setNewTagColor}
                  TAG_PRESET_COLORS={TAG_PRESET_COLORS}
                  onCreateAndAddTag={createAndAddTag}
                  analyticsDocId={analyticsDocId}
                  onSetAnalyticsDocId={setAnalyticsDocId}
                  analyticsData={analyticsData}
                  onSetAnalyticsData={setAnalyticsData}
                  onSetAnalyticsLoading={setAnalyticsLoading}
                />
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

      <TemplateVariableDialog
        open={pendingTemplateId !== null}
        variables={pendingTemplateVars}
        templateName={pendingTemplateName}
        onConfirm={handleTemplateVariableConfirm}
        onCancel={handleTemplateVariableCancel}
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
      {duplicateDialogDoc && (
        <DuplicateDialog
          documentId={duplicateDialogDoc.id}
          documentTitle={duplicateDialogDoc.title}
          isOpen={!!duplicateDialogDoc}
          onClose={() => setDuplicateDialogDoc(null)}
          onDuplicated={(newDocId) => {
            router.push(`/doc/${newDocId}`);
          }}
        />
      )}
    </div>
  );
}

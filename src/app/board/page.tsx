"use client";

import { useState, useEffect, useCallback, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
  status?: string;
  role?: string;
}

type Column = "draft" | "in_review" | "approved";

const COLUMNS: { id: Column; label: string; color: string; bgColor: string }[] = [
  { id: "draft", label: "Draft", color: "text-gray-600", bgColor: "bg-gray-100" },
  { id: "in_review", label: "In Review", color: "text-amber-700", bgColor: "bg-amber-50" },
  { id: "approved", label: "Approved", color: "text-green-700", bgColor: "bg-green-50" },
];

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

export default function BoardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragOverColumn, setDragOverColumn] = useState<Column | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocs(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  function getColumnDocs(column: Column): Doc[] {
    return docs.filter((d) => (d.status || "draft") === column);
  }

  function handleDragStart(e: DragEvent<HTMLDivElement>, docId: string) {
    e.dataTransfer.setData("text/plain", docId);
    e.dataTransfer.effectAllowed = "move";
    setMovingId(docId);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, column: Column) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(column);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetColumn: Column) {
    e.preventDefault();
    setDragOverColumn(null);
    const docId = e.dataTransfer.getData("text/plain");
    if (!docId) return;

    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;

    const currentStatus = doc.status || "draft";
    if (currentStatus === targetColumn) return;

    // Optimistically update UI
    setDocs((prev) =>
      prev.map((d) => (d.id === docId ? { ...d, status: targetColumn } : d))
    );
    setMovingId(null);

    try {
      const res = await fetch(`/api/documents/${docId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetColumn }),
      });
      if (!res.ok) {
        // Revert on failure
        setDocs((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: currentStatus } : d))
        );
        const errorData = await res.json().catch(() => ({}));
        console.error("Status change failed:", errorData.error || res.statusText);
      }
    } catch (err) {
      // Revert on error
      setDocs((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, status: currentStatus } : d))
      );
      console.error("Status change error:", err);
    }
  }

  function handleDragEnd() {
    setMovingId(null);
    setDragOverColumn(null);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--page-bg, #F2E8D5)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--card-border, rgba(0,0,0,0.08))" }}>
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium hover:underline"
            style={{ color: "var(--accent, #B8692A)" }}
          >
            &larr; Documents
          </Link>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary, #111827)" }}>
            Board View
          </h1>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="h-6 w-6 animate-spin" style={{ color: "var(--text-muted, #9ca3af)" }} viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex gap-4 p-6 overflow-x-auto min-h-[calc(100vh-73px)]">
          {COLUMNS.map((col) => {
            const columnDocs = getColumnDocs(col.id);
            return (
              <div
                key={col.id}
                className={`flex-1 min-w-[280px] max-w-[400px] rounded-xl border-2 transition-colors ${
                  dragOverColumn === col.id
                    ? "border-dashed"
                    : "border-transparent"
                }`}
                style={{
                  borderColor: dragOverColumn === col.id ? "var(--accent, #B8692A)" : "transparent",
                  background: "var(--card-bg, #ffffff)",
                }}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--card-border, rgba(0,0,0,0.08))" }}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${col.bgColor} ${col.color}`}>
                      {col.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted, #9ca3af)" }}>
                      {columnDocs.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="p-2 space-y-2 min-h-[200px]">
                  {columnDocs.length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color: "var(--text-muted, #9ca3af)" }}>
                      No documents
                    </p>
                  ) : (
                    columnDocs.map((doc) => (
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, doc.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => router.push(`/doc/${doc.id}`)}
                        className={`rounded-lg border p-3 cursor-pointer transition-all hover:shadow-md ${
                          movingId === doc.id ? "opacity-50" : ""
                        }`}
                        style={{
                          background: "var(--card-bg, #ffffff)",
                          borderColor: "var(--card-border, rgba(0,0,0,0.08))",
                        }}
                      >
                        <h3 className="text-sm font-medium truncate" style={{ color: "var(--text-primary, #111827)" }}>
                          {doc.title || "Untitled"}
                        </h3>
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted, #9ca3af)" }}>
                          {formatDate(doc.updatedAt)}
                        </p>
                        {doc.role && doc.role !== "owner" && (
                          <span className="inline-flex items-center px-1.5 py-0.5 mt-1.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                            {doc.role}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

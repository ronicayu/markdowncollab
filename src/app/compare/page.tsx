"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import DiffViewer from "@/components/DiffViewer";

interface DocData {
  title: string;
  markdown: string;
}

function CompareContent() {
  const searchParams = useSearchParams();
  const idA = searchParams.get("a");
  const idB = searchParams.get("b");

  const [docA, setDocA] = useState<DocData | null>(null);
  const [docB, setDocB] = useState<DocData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) {
      setError("Two document IDs are required (?a=...&b=...)");
      setLoading(false);
      return;
    }

    Promise.all([
      fetch(`/api/documents/markdown?id=${idA}`).then((r) => {
        if (!r.ok) throw new Error(`Document A not found`);
        return r.json();
      }),
      fetch(`/api/documents/markdown?id=${idB}`).then((r) => {
        if (!r.ok) throw new Error(`Document B not found`);
        return r.json();
      }),
    ])
      .then(([a, b]) => {
        setDocA(a);
        setDocB(b);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [idA, idB]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: "var(--page-bg)" }}
      >
        <p className="text-base" style={{ color: "var(--ink-soft)" }}>
          Loading documents...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-4"
        style={{ background: "var(--page-bg)" }}
      >
        <p className="text-base" style={{ color: "var(--warn)" }}>{error}</p>
        <Link
          href="/"
          className="text-[15px] font-semibold hover:underline"
          style={{ color: "var(--accent)" }}
        >
          Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--page-bg)" }}>
      {/* Header: white surface with whisper border (not dark chrome) */}
      <header
        className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between border-b"
        style={{ background: "var(--surface)", borderColor: "var(--rule)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-[15px] font-semibold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            &larr; Documents
          </Link>
          <h1
            className="text-[22px] font-bold"
            style={{ color: "var(--ink)", letterSpacing: "-0.25px", lineHeight: 1.27 }}
          >
            Document Comparison
          </h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background: "var(--surface)",
            borderColor: "var(--rule)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {docA && docB && (
            <DiffViewer
              oldText={docA.markdown}
              newText={docB.markdown}
              oldLabel={docA.title}
              newLabel={docB.title}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center min-h-screen"
          style={{ background: "var(--page-bg)" }}
        >
          <p className="text-base" style={{ color: "var(--ink-soft)" }}>Loading...</p>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

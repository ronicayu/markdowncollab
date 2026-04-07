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
      <div className="flex items-center justify-center min-h-screen bg-[#F2E8D5]">
        <p className="text-sm text-gray-500">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F2E8D5] gap-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link href="/" className="text-sm text-[#B8692A] hover:underline">
          Back to documents
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2E8D5]">
      <header className="sticky top-0 z-10 bg-[#111110] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
            &larr; Documents
          </Link>
          <h1 className="text-sm font-semibold">Document Comparison</h1>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
        <div className="flex items-center justify-center min-h-screen bg-[#F2E8D5]">
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
}

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then(setDocs);
  }, []);

  async function createDoc() {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    const doc = await res.json();
    router.push(`/doc/${doc.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-mono font-bold text-gray-900">MarkdownCollab</h1>
          <button
            onClick={createDoc}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            + New Document
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No documents yet. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/doc/${doc.id}`}
                className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors"
              >
                <span className="font-medium text-gray-900">{doc.title}</span>
                <span className="text-xs text-gray-400 ml-3">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

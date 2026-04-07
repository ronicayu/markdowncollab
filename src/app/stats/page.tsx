"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface StatsData {
  totalDocs: number;
  docsPerFolder: { folderId: string; folderName: string; count: number }[];
  mostActiveDocs: {
    documentId: string;
    title: string;
    activityCount: number;
  }[];
  collaborators: { name: string; activityCount: number }[];
  docsPerWeek: { week: string; count: number }[];
}

function BarChart({
  items,
  labelKey,
  valueKey,
}: {
  items: Record<string, any>[];
  labelKey: string;
  valueKey: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-400">No data yet.</p>;
  }
  const maxVal = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const pct = Math.max((item[valueKey] / maxVal) * 100, 2);
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-sm text-gray-600 w-32 truncate shrink-0">
              {item[labelKey]}
            </span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full bg-[#B8692A] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 w-10 text-right shrink-0">
              {item[valueKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFEF9]">
      {/* Header */}
      <header className="bg-[#1a1a19] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-white/60 hover:text-white transition-colors text-sm"
          >
            &larr; Back to Documents
          </Link>
          <h1 className="text-lg font-semibold">Document Statistics</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 border-2 border-[#B8692A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !stats ? (
        <div className="text-center py-20 text-gray-500">
          Failed to load statistics.
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Total Documents
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.totalDocs}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Folders Used
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.docsPerFolder.filter((f) => f.folderId !== "__root__").length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                Active Collaborators
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.collaborators.length}
              </p>
            </div>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Docs per folder */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                Documents per Folder
              </h2>
              <BarChart
                items={stats.docsPerFolder}
                labelKey="folderName"
                valueKey="count"
              />
            </section>

            {/* Most active docs */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                Most Active Documents
              </h2>
              <BarChart
                items={stats.mostActiveDocs}
                labelKey="title"
                valueKey="activityCount"
              />
            </section>

            {/* Top collaborators */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                Top Collaborators
              </h2>
              <BarChart
                items={stats.collaborators}
                labelKey="name"
                valueKey="activityCount"
              />
            </section>

            {/* Docs created per week */}
            <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">
                Documents Created per Week
              </h2>
              <BarChart
                items={stats.docsPerWeek}
                labelKey="week"
                valueKey="count"
              />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

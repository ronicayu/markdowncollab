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
    return <p className="text-sm" style={{ color: "var(--ink-muted)" }}>No data yet.</p>;
  }
  const maxVal = Math.max(...items.map((i) => i[valueKey]), 1);
  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const pct = Math.max((item[valueKey] / maxVal) * 100, 2);
        return (
          <div key={idx} className="flex items-center gap-3">
            <span className="text-[15px] w-32 truncate shrink-0" style={{ color: "var(--ink-soft)" }}>
              {item[labelKey]}
            </span>
            <div
              className="flex-1 rounded-full h-5 overflow-hidden"
              style={{ background: "var(--surface-2)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: "var(--accent)" }}
              />
            </div>
            <span className="text-[15px] font-semibold w-10 text-right shrink-0" style={{ color: "var(--ink)" }}>
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
    const controller = new AbortController();
    fetch("/api/stats", { signal: controller.signal })
      .then((r) => r.json())
      .then(setStats)
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch stats:", err);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid var(--rule)",
    boxShadow:
      "rgba(0,0,0,0.04) 0 4px 18px, rgba(0,0,0,0.027) 0 2.025px 7.84688px, rgba(0,0,0,0.02) 0 0.8px 2.925px, rgba(0,0,0,0.01) 0 0.175px 1.04062px",
  };

  return (
    <div className="min-h-screen" style={{ background: "#ffffff" }}>
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: "#ffffff", borderBottom: "1px solid var(--rule)", color: "var(--ink)" }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="transition-colors text-[15px] font-semibold hover:underline"
            style={{ color: "var(--accent)" }}
          >
            &larr; Back to Documents
          </Link>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--ink)", letterSpacing: "-0.25px" }}>
            Document Statistics
          </h1>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="h-8 w-8 rounded-full animate-spin"
            style={{ border: "2px solid var(--accent)", borderTopColor: "transparent" }}
          />
        </div>
      ) : !stats ? (
        <div className="text-center py-20" style={{ color: "var(--ink-soft)" }}>
          Failed to load statistics.
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl p-5" style={cardStyle}>
              <p
                className="text-xs mb-1"
                style={{ color: "var(--ink-muted)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Total Documents
              </p>
              <p className="text-[40px] font-bold leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}>
                {stats.totalDocs}
              </p>
            </div>
            <div className="rounded-xl p-5" style={cardStyle}>
              <p
                className="text-xs mb-1"
                style={{ color: "var(--ink-muted)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Folders Used
              </p>
              <p className="text-[40px] font-bold leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}>
                {stats.docsPerFolder.filter((f) => f.folderId !== "__root__").length}
              </p>
            </div>
            <div className="rounded-xl p-5" style={cardStyle}>
              <p
                className="text-xs mb-1"
                style={{ color: "var(--ink-muted)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Active Collaborators
              </p>
              <p className="text-[40px] font-bold leading-none" style={{ color: "var(--ink)", letterSpacing: "-0.025em" }}>
                {stats.collaborators.length}
              </p>
            </div>
          </div>

          {/* Charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Docs per folder */}
            <section className="rounded-xl p-5" style={cardStyle}>
              <h2
                className="text-xs mb-4"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Documents per Folder
              </h2>
              <BarChart
                items={stats.docsPerFolder}
                labelKey="folderName"
                valueKey="count"
              />
            </section>

            {/* Most active docs */}
            <section className="rounded-xl p-5" style={cardStyle}>
              <h2
                className="text-xs mb-4"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Most Active Documents
              </h2>
              <BarChart
                items={stats.mostActiveDocs}
                labelKey="title"
                valueKey="activityCount"
              />
            </section>

            {/* Top collaborators */}
            <section className="rounded-xl p-5" style={cardStyle}>
              <h2
                className="text-xs mb-4"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
                Top Collaborators
              </h2>
              <BarChart
                items={stats.collaborators}
                labelKey="name"
                valueKey="activityCount"
              />
            </section>

            {/* Docs created per week */}
            <section className="rounded-xl p-5" style={cardStyle}>
              <h2
                className="text-xs mb-4"
                style={{ color: "var(--ink-soft)", letterSpacing: "0.125px", fontWeight: 600, textTransform: "uppercase" }}
              >
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

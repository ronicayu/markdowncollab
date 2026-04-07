"use client";

import { useState, useEffect, useCallback } from "react";

interface TimelineEvent {
  id: string;
  type: "edit" | "comment" | "version" | "share" | "status";
  description: string;
  userName: string;
  createdAt: string;
  detail?: string | null;
}

type FilterType = "all" | "edits" | "comments" | "versions" | "shares";

const FILTER_OPTIONS: { label: string; value: FilterType }[] = [
  { label: "All", value: "all" },
  { label: "Edits", value: "edits" },
  { label: "Comments", value: "comments" },
  { label: "Versions", value: "versions" },
  { label: "Shares", value: "shares" },
];

function classifyAction(action: string): TimelineEvent["type"] {
  if (action.includes("comment")) return "comment";
  if (action.includes("version") || action.includes("restore")) return "version";
  if (action.includes("share") || action.includes("invite")) return "share";
  if (action.includes("status")) return "status";
  return "edit";
}

function filterMatches(type: TimelineEvent["type"], filter: FilterType): boolean {
  if (filter === "all") return true;
  if (filter === "edits") return type === "edit" || type === "status";
  if (filter === "comments") return type === "comment";
  if (filter === "versions") return type === "version";
  if (filter === "shares") return type === "share";
  return true;
}

function eventIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "comment":
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      );
    case "version":
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "share":
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
        </svg>
      );
    case "status":
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
      );
  }
}

const TYPE_COLORS: Record<TimelineEvent["type"], string> = {
  edit: "bg-blue-500",
  comment: "bg-amber-500",
  version: "bg-green-500",
  share: "bg-purple-500",
  status: "bg-teal-500",
};

function formatTimeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface DocumentTimelineProps {
  documentId: string;
}

export default function DocumentTimeline({ documentId }: DocumentTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch both activity and versions in parallel
      const [actRes, verRes] = await Promise.all([
        fetch(`/api/documents/${documentId}/activity?page=1`),
        fetch(`/api/documents/${documentId}/versions?page=1`),
      ]);

      const timeline: TimelineEvent[] = [];

      if (actRes.ok) {
        const actData = await actRes.json();
        for (const a of actData.activities || []) {
          timeline.push({
            id: a.id,
            type: classifyAction(a.action),
            description: a.action.replace(/_/g, " "),
            userName: a.userName,
            createdAt: a.createdAt,
            detail: a.detail,
          });
        }
      }

      if (verRes.ok) {
        const verData = await verRes.json();
        for (const v of verData.versions || []) {
          timeline.push({
            id: `ver-${v.id}`,
            type: "version",
            description: `Saved version (${v.type})`,
            userName: v.createdByName || "System",
            createdAt: v.createdAt,
            detail: v.title,
          });
        }
      }

      // Sort by date descending
      timeline.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setEvents(timeline);
    } catch (err) {
      console.error("Failed to fetch timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const filtered = events.filter((e) => filterMatches(e.type, filter));

  return (
    <div className="flex flex-col h-full">
      {/* Filter buttons */}
      <div className="flex gap-1 px-3 py-2 border-b border-[#E8D8C0] overflow-x-auto">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`shrink-0 px-2 py-1 rounded-full text-[10px] font-medium transition-colors ${
              filter === opt.value
                ? "bg-[#B8692A] text-white"
                : "bg-[#E8D8C0] text-gray-600 hover:bg-[#D4C4A8]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="h-5 w-5 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            No timeline events{filter !== "all" ? " matching this filter" : ""}.
          </p>
        ) : (
          <div className="relative ml-3">
            {/* Vertical line */}
            <div className="absolute left-0 top-0 bottom-0 w-px bg-[#E8D8C0]" />

            {filtered.map((event) => (
              <div key={event.id} className="relative pl-6 pb-4 last:pb-0">
                {/* Dot */}
                <div
                  className={`absolute left-0 top-1 -translate-x-1/2 h-4 w-4 rounded-full flex items-center justify-center text-white ${TYPE_COLORS[event.type]}`}
                >
                  {eventIcon(event.type)}
                </div>

                {/* Content */}
                <div className="bg-[#FFFEF9] border border-[#E8D8C0] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs font-medium text-gray-700">
                      {event.userName}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatTimeAgo(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 capitalize">
                    {event.description}
                  </p>
                  {event.detail && (
                    <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                      {event.detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

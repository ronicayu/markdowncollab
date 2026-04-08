"use client";

/**
 * ActivityDots — a 5-dot activity indicator (like GitHub contribution dots)
 * based on how recently a document was edited.
 * Green = today, lighter = older, gray = 5+ days.
 */
export default function ActivityDots({ updatedAt }: { updatedAt: string }) {
  const daysSince = Math.floor(
    (Date.now() - new Date(updatedAt).getTime()) / 86400000
  );

  // 5 dots representing: today, 1d, 2d, 3-4d, 5+d
  const thresholds = [0, 1, 2, 4, 7];
  const colors = [
    "#22c55e", // green-500 — very recent
    "#4ade80", // green-400
    "#86efac", // green-300
    "#bbf7d0", // green-200
    "#d1d5db", // gray-300 — stale
  ];

  return (
    <div className="flex items-center gap-0.5" title={`Last edited ${daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince}d ago`}`}>
      {thresholds.map((threshold, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full inline-block"
          style={{
            backgroundColor: daysSince <= threshold ? colors[0] : colors[Math.min(i, colors.length - 1)],
            opacity: daysSince <= threshold ? 1 : Math.max(0.3, 1 - (daysSince - threshold) / 14),
          }}
        />
      ))}
    </div>
  );
}

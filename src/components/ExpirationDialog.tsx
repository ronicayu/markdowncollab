"use client";

import { useState, useEffect } from "react";

interface ExpirationDialogProps {
  documentId: string;
  onClose: () => void;
}

const OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Never", days: null },
];

export default function ExpirationDialog({ documentId, onClose }: ExpirationDialogProps) {
  const [currentExpiration, setCurrentExpiration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/documents/${documentId}/expiration`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.expiresAt) setCurrentExpiration(data.expiresAt);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Failed to fetch expiration:", err);
      });
    return () => controller.abort();
  }, [documentId]);

  async function setExpiration(days: number | null) {
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/expiration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentExpiration(data.expiresAt);
        onClose();
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const expiresDate = currentExpiration ? new Date(currentExpiration) : null;
  const daysLeft = expiresDate
    ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 mx-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Set Document Expiration</h3>
        <p className="text-xs text-gray-500 mb-4">
          {daysLeft !== null
            ? `Currently expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`
            : "No expiration set"}
        </p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setExpiration(opt.days)}
              disabled={loading}
              className="w-full text-left px-3 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors disabled:opacity-50"
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

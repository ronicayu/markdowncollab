"use client";

import { useState } from "react";

interface ReminderDialogProps {
  documentId: string;
  onClose: () => void;
  onCreated?: () => void;
}

export default function ReminderDialog({
  documentId,
  onClose,
  onCreated,
}: ReminderDialogProps) {
  const [remindAt, setRemindAt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!remindAt) {
      setError("Please select a date and time.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, remindAt, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create reminder");
        return;
      }
      onCreated?.();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm mx-4 p-5"
      >
        <h3 className="text-base font-semibold text-gray-900 mb-4">
          Set Reminder
        </h3>

        <label className="block text-sm text-gray-600 mb-1">Date & Time</label>
        <input
          type="datetime-local"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#B8692A]"
        />

        <label className="block text-sm text-gray-600 mb-1">
          Message (optional)
        </label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g., Review the draft"
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:border-[#B8692A]"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-sm font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 rounded-md transition-colors"
          >
            {saving ? "Saving..." : "Set Reminder"}
          </button>
        </div>
      </form>
    </div>
  );
}

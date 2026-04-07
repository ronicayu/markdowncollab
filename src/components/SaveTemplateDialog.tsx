"use client";

import { useState } from "react";

interface SaveTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

export default function SaveTemplateDialog({ open, onClose, onSave }: SaveTemplateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(name.trim(), description.trim());
      setName("");
      setDescription("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Save as template</h2>
        <p className="text-sm text-gray-500 mb-4">Save this document&apos;s content as a reusable template.</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              id="template-name"
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Meeting Notes"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="template-desc" className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              id="template-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="text-sm font-medium text-white bg-[#B8692A] hover:bg-[#96541F] disabled:bg-gray-300 px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

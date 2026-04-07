"use client";

import { useState, useEffect } from "react";

interface Share {
  id: string;
  email: string | null;
  role: string;
  shareToken: string | null;
}

interface ShareDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareDialog({ documentId, isOpen, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [linkRole, setLinkRole] = useState<"viewer" | "editor">("viewer");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchShares();
  }, [isOpen, documentId]);

  async function fetchShares() {
    try {
      const res = await fetch(`/api/documents/${documentId}/share`);
      if (!res.ok) return;
      const data: Share[] = await res.json();
      setShares(data.filter((s) => !s.shareToken));

      // Check if link sharing is enabled
      const linkShare = data.find((s) => s.shareToken);
      if (linkShare) {
        setLinkEnabled(true);
        setLinkRole(linkShare.role as "viewer" | "editor");
        setLinkUrl(`${window.location.origin}/doc/${documentId}?token=${linkShare.shareToken}`);
      } else {
        setLinkEnabled(false);
        setLinkUrl("");
      }
    } catch {
      // silently fail
    }
  }

  async function handleAddShare() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to share");
        return;
      }
      setEmail("");
      fetchShares();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveShare(shareId: string) {
    await fetch(`/api/documents/${documentId}/share/${shareId}`, {
      method: "DELETE",
    });
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  }

  async function toggleLinkSharing() {
    const newEnabled = !linkEnabled;
    const res = await fetch(`/api/documents/${documentId}/share-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled, role: linkRole }),
    });
    const data = await res.json();
    if (newEnabled && data.shareToken) {
      setLinkEnabled(true);
      setLinkUrl(`${window.location.origin}${data.url}`);
    } else {
      setLinkEnabled(false);
      setLinkUrl("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 id="share-dialog-title" className="text-base font-semibold text-gray-900 mb-4">Share document</h3>

        {/* Email share form */}
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddShare()}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#B8692A]"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={handleAddShare}
            disabled={loading || !email.trim()}
            className="shrink-0 bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Share
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {/* Current shares list */}
        {shares.length > 0 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-4 max-h-40 overflow-y-auto">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{share.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{share.role}</p>
                </div>
                <button
                  onClick={() => handleRemoveShare(share.id)}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link sharing section */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Anyone with the link</p>
              <p className="text-xs text-gray-400">
                {linkEnabled ? `Can ${linkRole === "editor" ? "edit" : "view"}` : "Disabled"}
              </p>
            </div>
            <button
              onClick={toggleLinkSharing}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                linkEnabled ? "bg-[#B8692A]" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  linkEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {linkEnabled && (
            <>
              <div className="flex gap-2 mb-2">
                <select
                  value={linkRole}
                  onChange={async (e) => {
                    const newRole = e.target.value as "viewer" | "editor";
                    setLinkRole(newRole);
                    // Update the link role on the server
                    const res = await fetch(`/api/documents/${documentId}/share-link`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled: true, role: newRole }),
                    });
                    const data = await res.json();
                    if (data.shareToken) {
                      setLinkUrl(`${window.location.origin}${data.url}`);
                    }
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                >
                  <option value="viewer">Can view</option>
                  <option value="editor">Can edit</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={linkUrl}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 text-sm font-medium bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import { toast } from "@/lib/toast";

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
  const [showQr, setShowQr] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const generateQR = useCallback(async () => {
    if (!qrCanvasRef.current) return;
    const url = `${window.location.origin}/doc/${documentId}`;
    try {
      await QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 200,
        margin: 2,
        color: { dark: "#31302e", light: "#ffffff" },
      });
    } catch (err) {
      console.error("QR generation failed:", err);
    }
  }, [documentId]);

  useEffect(() => {
    if (showQr) generateQR();
  }, [showQr, generateQR]);

  async function downloadQR() {
    if (!qrCanvasRef.current) return;
    const url = `${window.location.origin}/doc/${documentId}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: { dark: "#31302e", light: "#ffffff" },
      });
      const link = document.createElement("a");
      link.download = `qr-${documentId.slice(0, 8)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("QR download failed:", err);
    }
  }

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
      toast("Link copied to clipboard", "success");
    } catch {
      toast("Failed to copy link — try selecting and copying manually", "error");
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 id="share-dialog-title" className="text-base font-semibold text-[#31302e] mb-4">Share document</h3>

        {/* Email share form */}
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddShare()}
            className="flex-1 min-w-0 border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0075de] focus:ring-1 focus:ring-[#0075de]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="border border-[rgba(0,0,0,0.1)] rounded-lg px-2 py-2 text-sm outline-none focus:border-[#0075de]"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={handleAddShare}
            disabled={loading || !email.trim()}
            className="shrink-0 bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Share
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {/* Current shares list */}
        {shares.length > 0 && (
          <div className="border border-[rgba(0,0,0,0.1)] rounded-lg divide-y divide-[rgba(0,0,0,0.1)] mb-4 max-h-40 overflow-y-auto">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-[#31302e] truncate">{share.email}</p>
                  <p className="text-xs text-[#a39e98] capitalize">{share.role}</p>
                </div>
                <button
                  onClick={() => handleRemoveShare(share.id)}
                  className="shrink-0 text-xs text-[#a39e98] hover:text-red-500 transition-colors ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link sharing section */}
        <div className="border-t border-[rgba(0,0,0,0.1)] pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-[#31302e]">Anyone with the link</p>
              <p className="text-xs text-[#a39e98]">
                {linkEnabled ? `Can ${linkRole === "editor" ? "edit" : "view"}` : "Disabled"}
              </p>
            </div>
            <button
              onClick={toggleLinkSharing}
              aria-label={linkEnabled ? "Disable link sharing" : "Enable link sharing"}
              aria-pressed={linkEnabled}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                linkEnabled ? "bg-[#0075de]" : "bg-[#dddddd]"
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
                  className="border border-[rgba(0,0,0,0.1)] rounded-lg px-2 py-1.5 text-sm outline-none"
                >
                  <option value="viewer">Can view</option>
                  <option value="editor">Can edit</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={linkUrl}
                  className="flex-1 min-w-0 border border-[rgba(0,0,0,0.1)] rounded-lg px-3 py-2 text-sm text-[#615d59] bg-[#f6f5f4] select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 text-sm font-medium bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* QR Code section */}
        <div className="border-t border-[rgba(0,0,0,0.1)] pt-4 mt-2">
          <button
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="flex items-center gap-2 text-sm font-medium text-[#31302e] hover:text-[#31302e] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
            {showQr ? "Hide QR Code" : "Show QR Code"}
          </button>
          {showQr && (
            <div className="mt-3 flex flex-col items-center gap-3">
              <canvas ref={qrCanvasRef} className="rounded-lg border border-[rgba(0,0,0,0.1)]" />
              <button
                onClick={downloadQR}
                className="text-xs font-medium bg-[#0075de] hover:bg-[#005bab] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Download QR as PNG
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            aria-label="Close share dialog"
            className="text-sm font-medium text-[#615d59] hover:text-[#31302e] px-3 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

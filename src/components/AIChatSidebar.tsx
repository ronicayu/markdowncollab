"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
  tsLabel?: string;
}

interface AIChatSidebarProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

function relativeLabel(date: Date, now: Date = new Date()) {
  const diffMin = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (diffMin < 1) return "JUST NOW";
  if (diffMin < 60) return `${diffMin}M`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}H`;
  return `${Math.floor(diffHr / 24)}D`;
}

export default function AIChatSidebar({
  documentId,
  isOpen,
  onClose,
}: AIChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const now = new Date();
    const userMsg: Message = { role: "user", content: text, tsLabel: relativeLabel(now, now) };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          messages: updatedMessages,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Request failed" }));
        setError(data.error || "Request failed");
        setLoading(false);
        return;
      }

      const data = await res.json();
      const replyTs = new Date();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.content, tsLabel: relativeLabel(replyTs, replyTs) },
      ]);
    } catch {
      setError("Failed to reach AI. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, documentId]);

  if (!isOpen) return null;

  return (
    <aside className="mc-pair w-[360px] max-w-[40vw] shrink-0 h-full" aria-label="Editor agent">
      <div className="mc-pair-head">
        <span className="mc-avatar-ai" aria-hidden>✦</span>
        <div className="info">
          <div className="name">
            Editor agent <span className="mc-badge-ai">agent</span>
          </div>
          <div className="status">
            <span className="live-dot" />
            {loading ? "thinking…" : "ready · reads current document"}
          </div>
        </div>
        <button className="icon-btn" title="History" aria-label="History">↺</button>
        <button
          className="icon-btn"
          title="Close"
          aria-label="Close AI chat"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      <div className="mc-pair-scroll">
        {messages.length === 0 && !loading && (
          <div className="mb-4">
            <div className="mc-pair-msg agent">
              <div className="meta">
                <span className="mc-avatar-ai sm" aria-hidden>✦</span>
                <span className="nm">Editor agent</span>
                <span className="tm">JUST NOW</span>
              </div>
              <div className="body">
                Ask anything about this document, or tell me to edit it.
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {[
                "Summarize this document",
                "Find any issues",
                "Tighten § Goals — make the metrics concrete",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="block w-full text-left text-[12px] leading-snug px-3 py-2 rounded-lg border border-[var(--rule)] bg-[var(--surface-2)] text-[var(--ink-soft)] hover:text-[var(--ink)] hover:border-[var(--rule-2)] transition-colors font-[italic] [font-family:var(--font-doc)]"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="mc-pair-msg user">
              <div className="meta">YOU · {msg.tsLabel ?? ""}</div>
              <div className="instruction">{msg.content}</div>
            </div>
          ) : (
            <div key={i} className="mc-pair-msg agent">
              <div className="meta">
                <span className="mc-avatar-ai sm" aria-hidden>✦</span>
                <span className="nm">Editor agent</span>
                <span className="tm">{msg.tsLabel ?? ""}</span>
              </div>
              <div className="body whitespace-pre-wrap">{msg.content}</div>
            </div>
          )
        )}

        {loading && (
          <div className="mc-pair-msg agent">
            <div className="meta">
              <span className="mc-avatar-ai sm" aria-hidden>✦</span>
              <span className="nm">Editor agent</span>
              <span className="tm">NOW</span>
            </div>
            <div className="body inline-flex items-center gap-1 text-[var(--ink-muted)]">
              <span>thinking</span>
              <span className="typing-dot">.</span>
              <span className="typing-dot">.</span>
              <span className="typing-dot">.</span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-2">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="mc-pair-compose">
        <div className="mc-pair-input">
          <span className="slash">/</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask or instruct the agent…"
            rows={1}
            aria-label="Message the editor agent"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="send"
            aria-label="Send message"
          >
            ↵
          </button>
        </div>
        <div className="mc-pair-hints">
          <span className="h"><span className="mc-kbd">/</span>commands</span>
          <span className="h"><span className="mc-kbd">@</span>source</span>
          <span className="h"><span className="mc-kbd">⇧</span><span className="mc-kbd">↵</span>newline</span>
        </div>
      </div>
    </aside>
  );
}

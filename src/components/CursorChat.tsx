"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { WebsocketProvider } from "y-websocket";

interface CursorChatProps {
  provider: WebsocketProvider;
  userName: string;
}

interface ChatBubble {
  clientId: number;
  name: string;
  color: string;
  message: string;
  timestamp: number;
}

export default function CursorChat({ provider, userName }: CursorChatProps) {
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState("");
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const backtickCount = useRef(0);
  const backtickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for double backtick to open chat input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      // Also skip if in the ProseMirror editor
      if (target.closest?.(".ProseMirror")) return;

      if (e.key === "`") {
        backtickCount.current++;
        if (backtickTimer.current) clearTimeout(backtickTimer.current);
        backtickTimer.current = setTimeout(() => {
          backtickCount.current = 0;
        }, 500);

        if (backtickCount.current >= 2) {
          e.preventDefault();
          backtickCount.current = 0;
          setShowInput(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Send message via awareness
  const sendMessage = useCallback(() => {
    const text = message.trim();
    if (!text) return;

    provider.awareness.setLocalStateField("chat", {
      message: text,
      timestamp: Date.now(),
    });

    setMessage("");
    setShowInput(false);

    // Auto-clear after 5s
    setTimeout(() => {
      provider.awareness.setLocalStateField("chat", null);
    }, 5000);
  }, [message, provider]);

  // Listen for remote chat messages via awareness
  useEffect(() => {
    const update = () => {
      const states = provider.awareness.getStates();
      const now = Date.now();
      const activeBubbles: ChatBubble[] = [];

      states.forEach((state, clientId) => {
        if (clientId === provider.awareness.clientID) return;
        const chat = state.chat;
        const user = state.user;
        if (!chat?.message || !user?.name) return;
        // Only show messages less than 5 seconds old
        if (now - chat.timestamp > 5000) return;
        activeBubbles.push({
          clientId,
          name: user.name,
          color: user.color || "#6366f1",
          message: chat.message,
          timestamp: chat.timestamp,
        });
      });

      setBubbles(activeBubbles);
    };

    provider.awareness.on("change", update);
    // Poll to expire old messages
    const interval = setInterval(update, 1000);

    return () => {
      provider.awareness.off("change", update);
      clearInterval(interval);
    };
  }, [provider]);

  return (
    <>
      {/* Chat bubbles rendered near the top-right corner as notifications */}
      {bubbles.length > 0 && (
        <div className="fixed top-16 right-4 z-40 flex flex-col gap-2 max-w-xs">
          {bubbles.map((b) => (
            <div
              key={`${b.clientId}-${b.timestamp}`}
              className="flex items-start gap-2 bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2 animate-in slide-in-from-right"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                style={{ backgroundColor: b.color }}
              >
                {b.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-500">{b.name}</p>
                <p className="text-sm text-gray-900">{b.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat input toggle button in footer */}
      <button
        onClick={() => {
          setShowInput((v) => !v);
          if (!showInput) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Send a cursor chat message (press `` twice)"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        Chat
      </button>

      {/* Chat input popover */}
      {showInput && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-50 flex items-center gap-2 w-64">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
              if (e.key === "Escape") { setShowInput(false); setMessage(""); }
            }}
            placeholder="Type a message..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-gray-400"
            maxLength={100}
          />
          <button
            onClick={sendMessage}
            disabled={!message.trim()}
            className="text-xs px-2 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            Send
          </button>
        </div>
      )}
    </>
  );
}

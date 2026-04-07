"use client";

import { useState, useEffect, useRef } from "react";
import type { WebsocketProvider } from "y-websocket";

interface TypingIndicatorProps {
  provider: WebsocketProvider;
  currentClientId: number;
}

export default function TypingIndicator({ provider, currentClientId }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const prevRef = useRef<string>("");

  useEffect(() => {
    const update = () => {
      const states = provider.awareness.getStates();
      const names: string[] = [];
      states.forEach((state, clientId) => {
        if (clientId === currentClientId) return;
        if (state.typing && state.user?.name) {
          names.push(state.user.name);
        }
      });
      // Only update state if the list actually changed
      const key = names.sort().join(",");
      if (key !== prevRef.current) {
        prevRef.current = key;
        setTypingUsers([...names]);
      }
    };

    provider.awareness.on("change", update);
    return () => {
      provider.awareness.off("change", update);
    };
  }, [provider, currentClientId]);

  if (typingUsers.length === 0) {
    return null;
  }

  const text =
    typingUsers.length === 1
      ? `${typingUsers[0]} is typing`
      : typingUsers.length === 2
        ? `${typingUsers[0]} and ${typingUsers[1]} are typing`
        : `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;

  return (
    <div
      className="typing-indicator flex items-center gap-1.5 px-4 py-1 text-xs text-[var(--text-muted)] bg-[var(--toolbar-bg)] border-b border-[var(--toolbar-border)]"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="flex gap-0.5">
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
        <span className="typing-dot h-1 w-1 rounded-full bg-current" />
      </span>
      <span>{text}</span>
    </div>
  );
}

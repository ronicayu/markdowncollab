"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

interface OpenTab {
  id: string;
  title: string;
}

const STORAGE_KEY = "openTabs";

function getOpenTabs(): OpenTab[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveOpenTabs(tabs: OpenTab[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {
    // storage full
  }
}

export function trackTab(id: string, title: string) {
  const tabs = getOpenTabs();
  const existing = tabs.findIndex((t) => t.id === id);
  if (existing >= 0) {
    // Update title if changed
    tabs[existing].title = title;
  } else {
    tabs.push({ id, title });
  }
  saveOpenTabs(tabs);
  // Dispatch custom event so TabBar re-renders
  window.dispatchEvent(new CustomEvent("tabs-updated"));
}

export default function TabBar() {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const currentDocId = pathname?.startsWith("/doc/") ? pathname.split("/doc/")[1]?.split("/")[0] : null;

  const refresh = useCallback(() => {
    setTabs(getOpenTabs());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("tabs-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tabs-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  function handleCloseTab(e: React.MouseEvent, tabId: string) {
    e.stopPropagation();
    e.preventDefault();
    const updated = tabs.filter((t) => t.id !== tabId);
    saveOpenTabs(updated);
    setTabs(updated);
    // If we close the current tab, navigate to another open tab or home
    if (tabId === currentDocId) {
      if (updated.length > 0) {
        router.push(`/doc/${updated[updated.length - 1].id}`);
      } else {
        router.push("/");
      }
    }
  }

  // Cmd+W to close current tab
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        if (!currentDocId) return;
        e.preventDefault();
        const updated = tabs.filter((t) => t.id !== currentDocId);
        saveOpenTabs(updated);
        setTabs(updated);
        if (updated.length > 0) {
          router.push(`/doc/${updated[updated.length - 1].id}`);
        } else {
          router.push("/");
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [tabs, currentDocId, router]);

  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center gap-0.5 bg-[#1a1a19] px-2 py-1 overflow-x-auto scrollbar-none border-b border-white/5">
      {tabs.map((tab) => {
        const isActive = tab.id === currentDocId;
        return (
          <div
            key={tab.id}
            onClick={() => router.push(`/doc/${tab.id}`)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors group max-w-[180px] ${
              isActive
                ? "bg-white/12 text-white"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
            title={tab.title}
          >
            <span className="truncate">{tab.title || "Untitled"}</span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className="shrink-0 h-4 w-4 rounded flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
              aria-label={`Close ${tab.title}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

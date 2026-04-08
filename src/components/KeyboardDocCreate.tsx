"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Global Cmd+N listener that creates a new blank document and navigates to it.
 * Prevents the browser's default "new window" behavior.
 */
export default function KeyboardDocCreate() {
  const router = useRouter();

  useEffect(() => {
    let creating = false;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        if (creating) return;
        creating = true;
        try {
          const res = await fetch("/api/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "Untitled" }),
          });
          if (res.ok) {
            const doc = await res.json();
            router.push(`/doc/${doc.id}`);
          }
        } catch {
          // silently fail
        } finally {
          creating = false;
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}

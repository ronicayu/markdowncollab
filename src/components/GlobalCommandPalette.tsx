"use client";

import { useEffect, useState } from "react";
import CommandPalette from "./CommandPalette";

export default function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "k")) {
        // Don't intercept Cmd+K when inside the editor (that opens the link dialog)
        const target = e.target as HTMLElement;
        const isInEditor = target.closest?.(".ProseMirror");
        if (e.key === "k" && isInEditor) return;
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <CommandPalette open={open} onClose={() => setOpen(false)} />;
}

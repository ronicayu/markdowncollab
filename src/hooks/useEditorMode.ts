"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type EditorMode,
  type UserRole,
  allowedModes,
  clampMode,
  cycleMode,
  readStoredMode,
  writeStoredMode,
} from "@/lib/editor-mode";
import { getKeybindings } from "@/lib/keybindings";

interface UseEditorModeArgs {
  docId: string;
  userRole: UserRole;
  isMobile: boolean;
}

interface UseEditorModeResult {
  mode: EditorMode;
  setMode: (next: EditorMode) => void;
  allowed: EditorMode[];
}

export function useEditorMode({
  docId,
  userRole,
  isMobile,
}: UseEditorModeArgs): UseEditorModeResult {
  const [stored, setStored] = useState<EditorMode | null>(() =>
    readStoredMode(docId),
  );

  const allowed = useMemo(() => allowedModes(userRole), [userRole]);

  const mode: EditorMode = useMemo(() => {
    if (stored) return clampMode(stored, userRole);
    const preferred: EditorMode = isMobile ? "view" : "edit";
    return clampMode(preferred, userRole);
  }, [stored, userRole, isMobile]);

  const setMode = useCallback(
    (next: EditorMode) => {
      if (!allowed.includes(next)) return;
      writeStoredMode(docId, next);
      setStored(next);
    },
    [allowed, docId],
  );

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== `editorMode:${docId}` && e.key !== "editorMode:default") return;
      setStored(readStoredMode(docId));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [docId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const combo = getKeybindings().cycleEditorMode || "Mod+Shift+M";
      const parts = combo.toLowerCase().split("+");
      const needMod = parts.includes("mod");
      const needShift = parts.includes("shift");
      const needAlt = parts.includes("alt");
      const key = parts[parts.length - 1];
      const modOk = needMod ? e.metaKey || e.ctrlKey : !(e.metaKey || e.ctrlKey);
      const shiftOk = needShift ? e.shiftKey : !e.shiftKey;
      const altOk = needAlt ? e.altKey : !e.altKey;
      if (!modOk || !shiftOk || !altOk) return;
      if (e.key.toLowerCase() !== key) return;
      e.preventDefault();
      const next = cycleMode(mode, allowed);
      if (next !== mode && allowed.includes(next)) {
        writeStoredMode(docId, next);
        setStored(next);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, allowed, docId]);

  return { mode, setMode, allowed };
}

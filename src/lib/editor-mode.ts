export type EditorMode = "edit" | "suggest" | "view";

export type UserRole = "owner" | "editor" | "viewer" | null | undefined;

const MODE_ORDER: EditorMode[] = ["edit", "suggest", "view"];

export function allowedModes(role: UserRole): EditorMode[] {
  if (role === "owner" || role === "editor") return ["edit", "suggest", "view"];
  return ["view"];
}

export function clampMode(mode: EditorMode, role: UserRole): EditorMode {
  const allowed = allowedModes(role);
  if (allowed.includes(mode)) return mode;
  return allowed[0];
}

export function cycleMode(current: EditorMode, allowed: EditorMode[]): EditorMode {
  if (allowed.length === 0) return current;
  const filtered = MODE_ORDER.filter((m) => allowed.includes(m));
  const idx = filtered.indexOf(current);
  if (idx === -1) return filtered[0];
  return filtered[(idx + 1) % filtered.length];
}

const PER_DOC_KEY = (docId: string) => `editorMode:${docId}`;
const DEFAULT_KEY = "editorMode:default";

function isEditorMode(v: unknown): v is EditorMode {
  return v === "edit" || v === "suggest" || v === "view";
}

export function readStoredMode(docId: string): EditorMode | null {
  if (typeof window === "undefined") return null;
  try {
    const perDoc = localStorage.getItem(PER_DOC_KEY(docId));
    if (isEditorMode(perDoc)) return perDoc;
    const fallback = localStorage.getItem(DEFAULT_KEY);
    if (isEditorMode(fallback)) return fallback;
    return null;
  } catch {
    return null;
  }
}

export function writeStoredMode(docId: string, mode: EditorMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PER_DOC_KEY(docId), mode);
    localStorage.setItem(DEFAULT_KEY, mode);
  } catch {
    // localStorage full/unavailable — non-fatal
  }
}

export function initialMode(opts: {
  docId: string;
  role: UserRole;
  isMobile: boolean;
}): EditorMode {
  const stored = readStoredMode(opts.docId);
  if (stored) return clampMode(stored, opts.role);
  const untamed: EditorMode = opts.isMobile ? "view" : "edit";
  return clampMode(untamed, opts.role);
}

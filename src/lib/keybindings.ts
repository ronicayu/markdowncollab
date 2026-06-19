/**
 * Keyboard shortcut remapping — stores user overrides in localStorage,
 * optionally synced to UserPreference.keyboardOverrides via API.
 * Provides conflict detection and ProseMirror-compatible key conversion.
 */

const STORAGE_KEY = "markdown-collab-keybindings";

export interface KeybindingMap {
  [action: string]: string;
}

export const DEFAULT_KEYBINDINGS: KeybindingMap = {
  bold: "Mod+B",
  italic: "Mod+I",
  underline: "Mod+U",
  "inline-code": "Mod+E",
  strikethrough: "Mod+Shift+X",
  link: "Mod+K",
  "heading-1": "Mod+Alt+1",
  "heading-2": "Mod+Alt+2",
  "heading-3": "Mod+Alt+3",
  "heading-4": "Mod+Alt+4",
  "heading-5": "Mod+Alt+5",
  "heading-6": "Mod+Alt+6",
  "ordered-list": "Mod+Shift+7",
  "bullet-list": "Mod+Shift+8",
  blockquote: "Mod+Shift+9",
  "code-block": "Mod+Alt+C",
  "align-left": "Mod+Shift+L",
  "align-center": "Mod+Shift+E",
  "align-right": "Mod+Shift+R",
  find: "Mod+F",
  "find-replace": "Mod+H",
  undo: "Mod+Z",
  redo: "Mod+Shift+Z",
  "command-palette": "Mod+P",
  "shortcuts-help": "Mod+/",
  cycleEditorMode: "Mod+Shift+M",
};

function getOverrides(): KeybindingMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: KeybindingMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // localStorage full or unavailable
  }
}

/**
 * Returns merged keybindings (defaults + user overrides).
 */
export function getKeybindings(): KeybindingMap {
  const overrides = getOverrides();
  return { ...DEFAULT_KEYBINDINGS, ...overrides };
}

/**
 * Returns only the user-customized keys (action names).
 */
export function getCustomizedActions(): Set<string> {
  return new Set(Object.keys(getOverrides()));
}

/**
 * Save a single keybinding override.
 */
export function setKeybinding(action: string, keys: string): void {
  const overrides = getOverrides();
  overrides[action] = keys;
  saveOverrides(overrides);
}

/**
 * Clear all user overrides, restoring defaults.
 */
export function resetKeybindings(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Detect conflicting keybindings. Returns a map of key combo -> list of actions
 * that share the same combo (only entries with 2+ actions are real conflicts).
 */
export function detectConflicts(bindings?: KeybindingMap): Record<string, string[]> {
  const map = bindings ?? getKeybindings();
  const comboToActions: Record<string, string[]> = {};
  for (const [action, combo] of Object.entries(map)) {
    const normalized = combo.toLowerCase();
    if (!comboToActions[normalized]) comboToActions[normalized] = [];
    comboToActions[normalized].push(action);
  }
  const conflicts: Record<string, string[]> = {};
  for (const [combo, actions] of Object.entries(comboToActions)) {
    if (actions.length > 1) conflicts[combo] = actions;
  }
  return conflicts;
}

/**
 * Check if a specific key combo conflicts with existing bindings.
 * Returns the action name it conflicts with, or null.
 */
export function findConflict(combo: string, excludeAction: string): string | null {
  const bindings = getKeybindings();
  const normalized = combo.toLowerCase();
  for (const [action, bound] of Object.entries(bindings)) {
    if (action === excludeAction) continue;
    if (bound.toLowerCase() === normalized) return action;
  }
  return null;
}

/**
 * Convert our "Mod+Shift+B" notation to ProseMirror keymap format "Mod-Shift-b".
 */
export function toProseMirrorKey(combo: string): string {
  return combo
    .split("+")
    .map((part, i, arr) => {
      // Last part is the actual key — lowercase it for prosemirror
      if (i === arr.length - 1) return part.toLowerCase();
      // Modifier parts stay capitalized
      return part;
    })
    .join("-");
}

/**
 * Persist keyboard overrides to the server (UserPreference model).
 * Fire-and-forget — does not block the UI.
 */
export async function syncOverridesToServer(): Promise<void> {
  const overrides = getOverrides();
  try {
    await fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyboardOverrides: overrides }),
    });
  } catch {
    // Network error — localStorage is the primary store
  }
}

/**
 * Load keyboard overrides from the server and merge into localStorage.
 * Server values are used only if localStorage has no overrides yet.
 */
export async function loadOverridesFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const localOverrides = getOverrides();
  if (Object.keys(localOverrides).length > 0) return; // local takes priority
  try {
    const res = await fetch("/api/user/preferences");
    if (!res.ok) return;
    const data = await res.json();
    if (data.keyboardOverrides && typeof data.keyboardOverrides === "object") {
      saveOverrides(data.keyboardOverrides);
    }
  } catch {
    // ignore
  }
}

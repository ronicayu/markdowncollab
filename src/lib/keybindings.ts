/**
 * Keyboard shortcut remapping — stores user overrides in localStorage.
 * For v1, this records preferences and displays them in the UI.
 * Actual Tiptap extension remapping can be added later.
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
  highlight: "Mod+Shift+H",
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

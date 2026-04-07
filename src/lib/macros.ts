/**
 * Keyboard macro recording and playback.
 * Records keydown events on the editor and replays them by dispatching
 * the same KeyboardEvent objects.
 */

export interface RecordedKey {
  key: string;
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

export interface Macro {
  name: string;
  keys: RecordedKey[];
  createdAt: string;
}

const STORAGE_KEY = "markdown-collab-macros";

export function loadMacros(): Macro[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMacro(macro: Macro): void {
  const macros = loadMacros();
  // Replace existing macro with same name, or add new
  const idx = macros.findIndex((m) => m.name === macro.name);
  if (idx >= 0) {
    macros[idx] = macro;
  } else {
    macros.push(macro);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export function deleteMacro(name: string): void {
  const macros = loadMacros().filter((m) => m.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

export function recordedKeyFromEvent(e: KeyboardEvent): RecordedKey {
  return {
    key: e.key,
    code: e.code,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
  };
}

export function replayMacro(
  target: HTMLElement,
  keys: RecordedKey[],
  delayMs = 20
): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    function next() {
      if (i >= keys.length) {
        resolve();
        return;
      }
      const rk = keys[i];
      const event = new KeyboardEvent("keydown", {
        key: rk.key,
        code: rk.code,
        ctrlKey: rk.ctrlKey,
        shiftKey: rk.shiftKey,
        altKey: rk.altKey,
        metaKey: rk.metaKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(event);

      // For printable characters, also dispatch input-like behavior
      if (rk.key.length === 1 && !rk.ctrlKey && !rk.metaKey && !rk.altKey) {
        const inputEvent = new InputEvent("beforeinput", {
          data: rk.key,
          inputType: "insertText",
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(inputEvent);
      }

      i++;
      setTimeout(next, delayMs);
    }
    next();
  });
}

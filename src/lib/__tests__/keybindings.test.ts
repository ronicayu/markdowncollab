import { describe, it, expect, beforeEach } from "vitest";
import {
  getKeybindings,
  getCustomizedActions,
  setKeybinding,
  resetKeybindings,
  DEFAULT_KEYBINDINGS,
} from "@/lib/keybindings";

beforeEach(() => {
  localStorage.clear();
});

describe("keybindings", () => {
  it("returns defaults when no overrides", () => {
    const bindings = getKeybindings();
    expect(bindings.bold).toBe("Mod+B");
    expect(bindings.italic).toBe("Mod+I");
  });

  it("setKeybinding overrides a default", () => {
    setKeybinding("bold", "Mod+Shift+B");
    const bindings = getKeybindings();
    expect(bindings.bold).toBe("Mod+Shift+B");
    // Others unchanged
    expect(bindings.italic).toBe("Mod+I");
  });

  it("getCustomizedActions tracks overridden keys", () => {
    expect(getCustomizedActions().size).toBe(0);
    setKeybinding("bold", "Mod+Shift+B");
    expect(getCustomizedActions().has("bold")).toBe(true);
    expect(getCustomizedActions().size).toBe(1);
  });

  it("resetKeybindings clears all overrides", () => {
    setKeybinding("bold", "Mod+Shift+B");
    setKeybinding("italic", "Mod+Shift+I");
    resetKeybindings();
    const bindings = getKeybindings();
    expect(bindings.bold).toBe(DEFAULT_KEYBINDINGS.bold);
    expect(getCustomizedActions().size).toBe(0);
  });

  it("preserves all default keys", () => {
    const bindings = getKeybindings();
    expect(Object.keys(bindings).length).toBeGreaterThanOrEqual(
      Object.keys(DEFAULT_KEYBINDINGS).length
    );
    for (const key of Object.keys(DEFAULT_KEYBINDINGS)) {
      expect(bindings[key]).toBe(DEFAULT_KEYBINDINGS[key]);
    }
  });
});

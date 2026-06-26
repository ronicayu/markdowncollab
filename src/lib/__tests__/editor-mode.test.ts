import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  allowedModes,
  clampMode,
  cycleMode,
  globallyEnabledModes,
  initialMode,
  readStoredMode,
  writeStoredMode,
  type EditorMode,
} from "../editor-mode";

describe("editor-mode helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("allowedModes", () => {
    it("gives owner all three", () => {
      expect(allowedModes("owner")).toEqual(["edit", "suggest", "view"]);
    });
    it("gives editor all three", () => {
      expect(allowedModes("editor")).toEqual(["edit", "suggest", "view"]);
    });
    it("limits viewer to view", () => {
      expect(allowedModes("viewer")).toEqual(["view"]);
    });
    it("treats null/undefined like viewer", () => {
      expect(allowedModes(null)).toEqual(["view"]);
      expect(allowedModes(undefined)).toEqual(["view"]);
    });
  });

  describe("clampMode", () => {
    it("preserves allowed mode", () => {
      expect(clampMode("suggest", "editor")).toBe("suggest");
      expect(clampMode("edit", "owner")).toBe("edit");
    });
    it("snaps viewer to view when asked for edit", () => {
      expect(clampMode("edit", "viewer")).toBe("view");
      expect(clampMode("suggest", "viewer")).toBe("view");
    });
    it("snaps null role to view", () => {
      expect(clampMode("edit", null)).toBe("view");
    });
  });

  describe("cycleMode", () => {
    const allAllowed: EditorMode[] = ["edit", "suggest", "view"];
    it("cycles edit → suggest → view → edit", () => {
      expect(cycleMode("edit", allAllowed)).toBe("suggest");
      expect(cycleMode("suggest", allAllowed)).toBe("view");
      expect(cycleMode("view", allAllowed)).toBe("edit");
    });
    it("skips disallowed modes", () => {
      expect(cycleMode("view", ["view"])).toBe("view");
    });
    it("returns current if current not in allowed", () => {
      expect(cycleMode("edit", ["view"])).toBe("view");
    });
  });

  describe("localStorage round-trip", () => {
    it("writes and reads per-doc mode", () => {
      writeStoredMode("doc-1", "suggest");
      expect(readStoredMode("doc-1")).toBe("suggest");
    });
    it("falls back to default key when per-doc missing", () => {
      localStorage.setItem("editorMode:default", "suggest");
      expect(readStoredMode("other-doc")).toBe("suggest");
    });
    it("returns null with nothing stored", () => {
      expect(readStoredMode("nope")).toBeNull();
    });
    it("ignores invalid stored values", () => {
      localStorage.setItem("editorMode:doc-x", "garbage");
      expect(readStoredMode("doc-x")).toBeNull();
    });
    it("writing updates default too", () => {
      writeStoredMode("doc-1", "view");
      expect(localStorage.getItem("editorMode:default")).toBe("view");
    });
  });

  describe("initialMode", () => {
    it("mobile + no storage → view", () => {
      expect(initialMode({ docId: "d", role: "editor", isMobile: true })).toBe("view");
    });
    it("desktop + no storage → edit for editor", () => {
      expect(initialMode({ docId: "d", role: "editor", isMobile: false })).toBe("edit");
    });
    it("viewer role always clamps to view", () => {
      writeStoredMode("d", "edit");
      expect(initialMode({ docId: "d", role: "viewer", isMobile: false })).toBe("view");
    });
    it("uses stored mode when present (even on mobile)", () => {
      writeStoredMode("d", "edit");
      expect(initialMode({ docId: "d", role: "editor", isMobile: true })).toBe("edit");
    });
  });

  describe("feature flags", () => {
    afterEach(() => {
      delete process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE;
      delete process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE;
    });

    describe("globallyEnabledModes", () => {
      it("enables all modes by default", () => {
        expect(globallyEnabledModes()).toEqual(["edit", "suggest", "view"]);
      });
      it("drops edit when disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        expect(globallyEnabledModes()).toEqual(["suggest", "view"]);
      });
      it("drops suggest when disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "true";
        expect(globallyEnabledModes()).toEqual(["edit", "view"]);
      });
      it("keeps view even when both edit and suggest are disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "true";
        expect(globallyEnabledModes()).toEqual(["view"]);
      });
      it("treats any value other than 'true' as enabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "false";
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "1";
        expect(globallyEnabledModes()).toEqual(["edit", "suggest", "view"]);
      });
    });

    describe("allowedModes respects flags", () => {
      it("removes edit from an editor when edit is disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        expect(allowedModes("editor")).toEqual(["suggest", "view"]);
      });
      it("removes suggest from an owner when suggest is disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "true";
        expect(allowedModes("owner")).toEqual(["edit", "view"]);
      });
      it("leaves viewer at view regardless of flags", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "true";
        expect(allowedModes("viewer")).toEqual(["view"]);
      });
    });

    describe("clampMode respects flags", () => {
      it("snaps a stored edit mode to suggest when edit is disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        expect(clampMode("edit", "editor")).toBe("suggest");
      });
      it("snaps to view when both writable modes are disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        process.env.NEXT_PUBLIC_DISABLE_SUGGEST_MODE = "true";
        expect(clampMode("edit", "owner")).toBe("view");
      });
    });

    describe("initialMode respects flags", () => {
      it("desktop editor falls back to suggest when edit is disabled", () => {
        process.env.NEXT_PUBLIC_DISABLE_EDIT_MODE = "true";
        expect(initialMode({ docId: "f", role: "editor", isMobile: false })).toBe("suggest");
      });
    });
  });
});

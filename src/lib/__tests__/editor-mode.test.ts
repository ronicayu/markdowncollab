import { describe, it, expect, beforeEach } from "vitest";
import {
  allowedModes,
  clampMode,
  cycleMode,
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
});

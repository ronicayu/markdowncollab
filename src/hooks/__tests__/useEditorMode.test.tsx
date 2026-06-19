import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorMode } from "../useEditorMode";

describe("useEditorMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("mobile + fresh storage → view (for editor role)", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "editor", isMobile: true }),
    );
    expect(result.current.mode).toBe("view");
  });

  it("desktop + fresh storage → edit (for editor role)", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "editor", isMobile: false }),
    );
    expect(result.current.mode).toBe("edit");
  });

  it("viewer role forces view even with stored 'edit'", () => {
    localStorage.setItem("editorMode:d1", "edit");
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "viewer", isMobile: false }),
    );
    expect(result.current.mode).toBe("view");
    expect(result.current.allowed).toEqual(["view"]);
  });

  it("setMode rejects disallowed mode", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "viewer", isMobile: false }),
    );
    act(() => result.current.setMode("edit"));
    expect(result.current.mode).toBe("view");
  });

  it("setMode persists allowed mode to localStorage", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "editor", isMobile: false }),
    );
    act(() => result.current.setMode("suggest"));
    expect(result.current.mode).toBe("suggest");
    expect(localStorage.getItem("editorMode:d1")).toBe("suggest");
    expect(localStorage.getItem("editorMode:default")).toBe("suggest");
  });

  it("Mod+Shift+M cycles through allowed modes", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "owner", isMobile: false }),
    );
    expect(result.current.mode).toBe("edit");
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "m", metaKey: true, shiftKey: true }),
      );
    });
    expect(result.current.mode).toBe("suggest");
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "m", metaKey: true, shiftKey: true }),
      );
    });
    expect(result.current.mode).toBe("view");
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "m", metaKey: true, shiftKey: true }),
      );
    });
    expect(result.current.mode).toBe("edit");
  });

  it("keyboard shortcut without modifiers does nothing", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "owner", isMobile: false }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "m" }));
    });
    expect(result.current.mode).toBe("edit");
  });

  it("storage event from another tab updates mode", () => {
    const { result } = renderHook(() =>
      useEditorMode({ docId: "d1", userRole: "editor", isMobile: false }),
    );
    expect(result.current.mode).toBe("edit");
    act(() => {
      localStorage.setItem("editorMode:d1", "suggest");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "editorMode:d1", newValue: "suggest" }),
      );
    });
    expect(result.current.mode).toBe("suggest");
  });

  it("role downgrade clamps current mode", () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: "editor" | "viewer" }) =>
        useEditorMode({ docId: "d1", userRole: role, isMobile: false }),
      { initialProps: { role: "editor" } },
    );
    act(() => result.current.setMode("suggest"));
    expect(result.current.mode).toBe("suggest");
    rerender({ role: "viewer" });
    expect(result.current.mode).toBe("view");
  });
});

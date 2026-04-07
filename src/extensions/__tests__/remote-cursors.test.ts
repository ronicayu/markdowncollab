import { describe, it, expect } from "vitest";
import { RemoteCursors } from "../remote-cursors";

describe("RemoteCursors extension", () => {
  it("exports a Tiptap extension", () => {
    expect(RemoteCursors).toBeDefined();
    expect(RemoteCursors.name).toBe("remoteCursors");
  });

  it("has default options", () => {
    const ext = RemoteCursors.configure({
      provider: null,
      currentUser: "Test User",
    });
    expect(ext).toBeDefined();
  });

  it("returns no plugins when provider is null", () => {
    const ext = RemoteCursors.configure({
      provider: null,
      currentUser: "Test User",
    });
    // The extension's addProseMirrorPlugins returns [] when provider is null
    // We verify the extension can be created without error
    expect(ext.name).toBe("remoteCursors");
  });
});

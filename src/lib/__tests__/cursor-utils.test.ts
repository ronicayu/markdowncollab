import { describe, it, expect } from "vitest";
import { getUserColor, CURSOR_COLORS } from "../cursor-utils";

describe("getUserColor", () => {
  it("returns a color from the CURSOR_COLORS array", () => {
    const color = getUserColor("Alice");
    expect(CURSOR_COLORS).toContain(color);
  });

  it("returns the same color for the same name", () => {
    const color1 = getUserColor("Bob");
    const color2 = getUserColor("Bob");
    expect(color1).toBe(color2);
  });

  it("returns different colors for different names", () => {
    // With 10 colors and carefully chosen names, most should differ
    const colors = new Set([
      getUserColor("Alice"),
      getUserColor("Bob"),
      getUserColor("Charlie"),
      getUserColor("Diana"),
      getUserColor("Eve"),
    ]);
    // At least 3 of 5 should be distinct (probabilistic but reliable with these names)
    expect(colors.size).toBeGreaterThanOrEqual(3);
  });

  it("handles empty string without crashing", () => {
    const color = getUserColor("");
    expect(CURSOR_COLORS).toContain(color);
  });

  it("handles unicode names", () => {
    const color = getUserColor("佐藤太郎");
    expect(CURSOR_COLORS).toContain(color);
  });
});

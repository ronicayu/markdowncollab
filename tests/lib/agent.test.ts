import { describe, it, expect } from "vitest";
import { parseSuggestions } from "@/lib/agent";

describe("parseSuggestions", () => {
  it("parses a valid JSON array of suggestions", () => {
    const response = `Here are my suggestions:
\`\`\`json
[
  {
    "original": "teh quick brown fox",
    "suggested": "the quick brown fox",
    "rationale": "Fixed typo in 'the'"
  },
  {
    "original": "jumps over the lasy dog",
    "suggested": "jumps over the lazy dog",
    "rationale": "Fixed typo in 'lazy'"
  }
]
\`\`\``;

    const result = parseSuggestions(response);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      original: "teh quick brown fox",
      suggested: "the quick brown fox",
      rationale: "Fixed typo in 'the'",
    });
    expect(result[1]).toEqual({
      original: "jumps over the lasy dog",
      suggested: "jumps over the lazy dog",
      rationale: "Fixed typo in 'lazy'",
    });
  });

  it("parses a bare JSON array without code fences", () => {
    const response = `[{"original": "foo", "suggested": "bar", "rationale": "test"}]`;
    const result = parseSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("foo");
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseSuggestions("this is not json at all");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty array '[]'", () => {
    const result = parseSuggestions("[]");
    expect(result).toEqual([]);
  });

  it("filters out items missing required fields", () => {
    const response = JSON.stringify([
      { original: "a", suggested: "b", rationale: "c" },
      { original: "a", suggested: "b" }, // missing rationale
      { foo: "bar" }, // completely wrong
    ]);
    const result = parseSuggestions(response);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("a");
  });
});

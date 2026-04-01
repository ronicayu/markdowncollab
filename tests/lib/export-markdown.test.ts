import { describe, it, expect } from "vitest";
import { cleanMarkdown } from "../../src/lib/export-markdown";

describe("cleanMarkdown", () => {
  it("strips suggestion-delete marks (keeps nothing)", () => {
    const html = '<p>Hello <mark data-suggestion-id="s1" data-suggestion-type="delete">old world</mark> new world</p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("new world");
    expect(result).not.toContain("old world");
  });

  it("strips suggestion-add marks (keeps the text)", () => {
    const html = '<p>Hello <mark data-suggestion-id="s1" data-suggestion-type="add">new text</mark></p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("new text");
    expect(result).not.toContain("data-suggestion");
  });

  it("strips comment marks (keeps the text)", () => {
    const html = '<p>Hello <mark data-comment-id="c1">commented text</mark></p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("commented text");
    expect(result).not.toContain("data-comment");
  });

  it("handles plain text with no marks", () => {
    const html = "<p>Hello world</p>";
    const result = cleanMarkdown(html);
    expect(result).toContain("Hello world");
  });
});

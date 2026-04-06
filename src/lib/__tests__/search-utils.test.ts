import { describe, it, expect } from "vitest";
import { findTextMatches, type SearchMatch } from "../search-utils";
import { Schema } from "@tiptap/pm/model";

// Minimal ProseMirror schema for testing
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { content: "inline*", group: "block" },
    text: { group: "inline" },
    heading: {
      content: "inline*",
      group: "block",
      attrs: { level: { default: 1 } },
    },
  },
});

function makeDoc(...paragraphs: string[]) {
  return schema.node(
    "doc",
    null,
    paragraphs.map((text) =>
      schema.node("paragraph", null, text ? [schema.text(text)] : [])
    )
  );
}

describe("findTextMatches", () => {
  it("returns empty array when query is empty", () => {
    const doc = makeDoc("Hello world");
    expect(findTextMatches(doc, "", false)).toEqual([]);
  });

  it("returns empty array when no matches found", () => {
    const doc = makeDoc("Hello world");
    expect(findTextMatches(doc, "xyz", false)).toEqual([]);
  });

  it("finds a single match", () => {
    const doc = makeDoc("Hello world");
    const matches = findTextMatches(doc, "world", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("world");
  });

  it("finds multiple matches in one paragraph", () => {
    const doc = makeDoc("the cat sat on the mat");
    const matches = findTextMatches(doc, "the", false);
    expect(matches).toHaveLength(2);
  });

  it("finds matches across multiple paragraphs", () => {
    const doc = makeDoc("Hello world", "Hello again");
    const matches = findTextMatches(doc, "Hello", false);
    expect(matches).toHaveLength(2);
  });

  it("case-insensitive search matches regardless of case", () => {
    const doc = makeDoc("Hello HELLO hello");
    const matches = findTextMatches(doc, "hello", false);
    expect(matches).toHaveLength(3);
  });

  it("case-sensitive search only matches exact case", () => {
    const doc = makeDoc("Hello HELLO hello");
    const matches = findTextMatches(doc, "hello", true);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("hello");
  });

  it("returns correct ProseMirror positions", () => {
    // ProseMirror: doc(0) > paragraph(1) > text starts at pos 1
    // "Hello world" — "world" starts at index 6, so pos = 1 + 6 = 7
    const doc = makeDoc("Hello world");
    const matches = findTextMatches(doc, "world", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].from).toBe(7);
    expect(matches[0].to).toBe(12);
  });

  it("handles empty document", () => {
    const doc = makeDoc("");
    expect(findTextMatches(doc, "test", false)).toEqual([]);
  });

  it("handles special regex characters in query", () => {
    const doc = makeDoc("price is $100.00 (USD)");
    const matches = findTextMatches(doc, "$100.00", false);
    expect(matches).toHaveLength(1);
    expect(matches[0].text).toBe("$100.00");
  });

  it("finds matches in heading nodes", () => {
    const doc = schema.node("doc", null, [
      schema.node("heading", { level: 1 }, [schema.text("My Title")]),
      schema.node("paragraph", null, [schema.text("body text")]),
    ]);
    const matches = findTextMatches(doc, "Title", false);
    expect(matches).toHaveLength(1);
  });
});

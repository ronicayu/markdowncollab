import { describe, it, expect } from "vitest";
import {
  calculateHealthScore,
  countSyllables,
  splitSentences,
  extractWords,
} from "../health-score";

describe("countSyllables", () => {
  it("counts single-syllable words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("dog")).toBe(1);
  });

  it("counts multi-syllable words", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("information")).toBe(4);
  });

  it("handles short words", () => {
    expect(countSyllables("a")).toBe(1);
    expect(countSyllables("I")).toBe(1);
    expect(countSyllables("to")).toBe(1);
  });
});

describe("splitSentences", () => {
  it("splits on period-space boundaries", () => {
    const result = splitSentences("Hello world. This is a test. Another sentence.");
    expect(result).toHaveLength(3);
  });

  it("handles single sentence", () => {
    const result = splitSentences("Just one sentence.");
    expect(result).toHaveLength(1);
  });

  it("handles empty text", () => {
    const result = splitSentences("");
    expect(result).toHaveLength(0);
  });

  it("handles text with newlines", () => {
    const result = splitSentences("First sentence.\nSecond sentence.");
    expect(result).toHaveLength(2);
  });
});

describe("extractWords", () => {
  it("extracts words from plain text", () => {
    const words = extractWords("Hello world foo bar");
    expect(words).toEqual(["Hello", "world", "foo", "bar"]);
  });

  it("strips markdown headings", () => {
    const words = extractWords("# Hello World\n\nSome text here.");
    expect(words).toContain("Hello");
    expect(words).toContain("World");
    expect(words).toContain("Some");
  });

  it("strips markdown links", () => {
    const words = extractWords("Click [here](https://example.com) please");
    expect(words).toContain("Click");
    expect(words).toContain("here");
    expect(words).toContain("please");
    expect(words.some((w) => w.includes("https"))).toBe(false);
  });

  it("strips code blocks", () => {
    const words = extractWords("Text before\n```\nconst x = 1;\n```\nText after");
    expect(words).toContain("Text");
    expect(words).toContain("after");
    // Code block content between ``` fences should be stripped
    expect(words.some((w) => w === "const")).toBe(false);
  });
});

describe("calculateHealthScore", () => {
  it("returns score 0 for empty text", () => {
    const result = calculateHealthScore("");
    expect(result.score).toBe(0);
    expect(result.color).toBe("red");
    expect(result.metrics.wordCount).toBe(0);
  });

  it("returns score 0 for near-blank text", () => {
    const result = calculateHealthScore("Hi");
    expect(result.score).toBe(0);
    expect(result.color).toBe("red");
  });

  it("returns a green score for well-structured content", () => {
    const text = `# Project Overview

This is a well-structured document with headings and links. It contains enough words to be meaningful. The sentences are clear and easy to read. We use simple language throughout the document.

## Details

Here are some details about the project. We focus on clarity and readability. Each section covers a different aspect. The content is organized logically.

For more info, see [our website](https://example.com). This helps readers find additional resources. The document has proper structure with multiple headings.

## Summary

In summary, this document demonstrates good writing practices. It has headings, links, and sufficient content. The reading level is appropriate for a general audience.`;

    const result = calculateHealthScore(text);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.metrics.hasHeadings).toBe(true);
    expect(result.metrics.hasLinks).toBe(true);
    expect(result.metrics.wordCountAppropriate).toBe(true);
    expect(result.metrics.wordCount).toBeGreaterThan(50);
  });

  it("returns red score for short unstructured text", () => {
    const text = "This is some text without any structure or links or headings.";
    const result = calculateHealthScore(text);
    expect(result.color).toBe("red");
    expect(result.metrics.hasHeadings).toBe(false);
    expect(result.metrics.hasLinks).toBe(false);
  });

  it("calculates template completeness when templateId is provided", () => {
    const text = `# Meeting Notes

## Agenda

- Item 1

## Discussion

We discussed things.

## Action Items

- [ ] Do stuff
`;
    const result = calculateHealthScore(text, "meeting-notes");
    expect(result.metrics.templateCompleteness).toBe(100);
  });

  it("calculates partial template completeness", () => {
    const text = `# Meeting Notes

## Agenda

- Item 1

Some content here to make it longer. We need enough words. This adds more content to the document so the word count is reasonable.
`;
    const result = calculateHealthScore(text, "meeting-notes");
    expect(result.metrics.templateCompleteness).toBeLessThan(100);
    expect(result.metrics.templateCompleteness).toBeGreaterThan(0);
  });

  it("returns null templateCompleteness for unknown template", () => {
    const text = "# Some content here with enough words to be meaningful and clear.";
    const result = calculateHealthScore(text, "unknown-template");
    expect(result.metrics.templateCompleteness).toBeNull();
  });

  it("calculates flesch reading ease correctly for simple text", () => {
    // Simple text should have higher flesch score
    const simpleText = "The cat sat on the mat. The dog ran in the park. It was a good day. The sun was out. Birds sang in the trees. Children played on the swings. Everyone was happy. Life was simple and good.";
    const result = calculateHealthScore(simpleText);
    expect(result.metrics.fleschReadingEase).toBeGreaterThan(60);
  });

  it("score is between 0 and 100", () => {
    const texts = [
      "",
      "Short.",
      "A medium length text that has a few sentences. It should score somewhere in the middle range.",
      "# Well Structured\n\nThis has [links](http://example.com) and headings. ".repeat(10),
    ];
    for (const text of texts) {
      const result = calculateHealthScore(text);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it("color follows score thresholds", () => {
    // We can't easily force exact scores, but we can test the mapping logic
    const emptyResult = calculateHealthScore("");
    expect(emptyResult.color).toBe("red"); // score 0

    const goodText = `# Great Document

This is a great document with all the right elements. It has headings for structure and organization. It has [links](https://example.com) for references. The sentences are clear and concise. We write in simple language.

## Section Two

More content here to ensure we have enough words. Each paragraph adds value. The reading level is comfortable. We avoid jargon and complex terms. Simple and effective communication.

## Conclusion

In conclusion, this is a well-written document. It meets all the quality criteria we look for. Good job on this one.`;
    const goodResult = calculateHealthScore(goodText);
    expect(["amber", "green"]).toContain(goodResult.color);
  });
});

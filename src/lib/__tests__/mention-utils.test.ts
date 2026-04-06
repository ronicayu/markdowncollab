import { describe, it, expect } from "vitest";
import {
  parseMentions,
  formatMention,
  renderMentionText,
  extractMentionedUserIds,
} from "../mention-utils";

describe("formatMention", () => {
  it("formats a mention as @[Name](id)", () => {
    expect(formatMention("Alice Smith", "user-1")).toBe("@[Alice Smith](user-1)");
  });
});

describe("parseMentions", () => {
  it("extracts mentions from text", () => {
    const text = "Hey @[Alice](user-1), can you review this?";
    const mentions = parseMentions(text);
    expect(mentions).toEqual([
      { name: "Alice", id: "user-1", fullMatch: "@[Alice](user-1)" },
    ]);
  });

  it("extracts multiple mentions", () => {
    const text = "@[Alice](user-1) and @[Bob Smith](user-2) should look at this";
    const mentions = parseMentions(text);
    expect(mentions).toHaveLength(2);
    expect(mentions[0].name).toBe("Alice");
    expect(mentions[1].name).toBe("Bob Smith");
  });

  it("returns empty array when no mentions", () => {
    expect(parseMentions("no mentions here")).toEqual([]);
  });

  it("handles mention at end of text", () => {
    const text = "Please review @[Carol](user-3)";
    const mentions = parseMentions(text);
    expect(mentions).toHaveLength(1);
    expect(mentions[0].id).toBe("user-3");
  });
});

describe("extractMentionedUserIds", () => {
  it("returns unique user IDs from text", () => {
    const text = "@[Alice](user-1) and @[Bob](user-2) and @[Alice](user-1) again";
    const ids = extractMentionedUserIds(text);
    expect(ids).toEqual(["user-1", "user-2"]);
  });

  it("returns empty array for no mentions", () => {
    expect(extractMentionedUserIds("hello")).toEqual([]);
  });
});

describe("renderMentionText", () => {
  it("converts mention syntax to display parts", () => {
    const text = "Hey @[Alice](user-1), check this";
    const parts = renderMentionText(text);
    expect(parts).toEqual([
      { type: "text", content: "Hey " },
      { type: "mention", content: "Alice", userId: "user-1" },
      { type: "text", content: ", check this" },
    ]);
  });

  it("handles text with no mentions", () => {
    const parts = renderMentionText("just text");
    expect(parts).toEqual([{ type: "text", content: "just text" }]);
  });

  it("handles text starting with a mention", () => {
    const parts = renderMentionText("@[Bob](user-2) said hello");
    expect(parts).toEqual([
      { type: "mention", content: "Bob", userId: "user-2" },
      { type: "text", content: " said hello" },
    ]);
  });

  it("handles consecutive mentions", () => {
    const parts = renderMentionText("@[Alice](user-1)@[Bob](user-2)");
    expect(parts).toEqual([
      { type: "mention", content: "Alice", userId: "user-1" },
      { type: "mention", content: "Bob", userId: "user-2" },
    ]);
  });
});

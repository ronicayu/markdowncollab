import { describe, it, expect } from "vitest";
import { buildReviewPrompt, parseSuggestions } from "../agent";

describe("buildReviewPrompt", () => {
  it("builds a generic prompt when no template is provided", () => {
    const prompt = buildReviewPrompt("Some document text", {});
    expect(prompt).toContain("Review for:");
    expect(prompt).toContain("general writing quality");
    expect(prompt).toContain("Some document text");
  });

  it("includes meeting-notes guidance when templateId is meeting-notes", () => {
    const prompt = buildReviewPrompt("Meeting content", {
      templateId: "meeting-notes",
      title: "Sprint Planning",
    });
    expect(prompt).toContain("meeting notes");
    expect(prompt).toContain("Sprint Planning");
    expect(prompt).toContain("action items");
  });

  it("includes ADR guidance when templateId is adr", () => {
    const prompt = buildReviewPrompt("ADR content", {
      templateId: "adr",
      title: "Use PostgreSQL",
    });
    expect(prompt).toContain("architecture decision record");
    expect(prompt).toContain("Use PostgreSQL");
    expect(prompt).toContain("decision is clearly stated");
  });

  it("includes RFC guidance when templateId is rfc", () => {
    const prompt = buildReviewPrompt("RFC content", {
      templateId: "rfc",
      title: "New API Design",
    });
    expect(prompt).toContain("RFC");
    expect(prompt).toContain("New API Design");
    expect(prompt).toContain("motivation");
  });

  it("includes standup guidance when templateId is standup", () => {
    const prompt = buildReviewPrompt("Standup content", {
      templateId: "standup",
      title: "Daily Standup",
    });
    expect(prompt).toContain("standup");
    expect(prompt).toContain("blockers");
  });

  it("includes project-brief guidance when templateId is project-brief", () => {
    const prompt = buildReviewPrompt("Brief content", {
      templateId: "project-brief",
      title: "Q2 Roadmap",
    });
    expect(prompt).toContain("project brief");
    expect(prompt).toContain("scope");
  });

  it("includes bug-report guidance when templateId is bug-report", () => {
    const prompt = buildReviewPrompt("Bug content", {
      templateId: "bug-report",
      title: "Login Crash",
    });
    expect(prompt).toContain("bug report");
    expect(prompt).toContain("steps to reproduce");
  });

  it("falls back to generic for unknown template", () => {
    const prompt = buildReviewPrompt("Content", {
      templateId: "unknown-template",
      title: "Some Doc",
    });
    expect(prompt).toContain("general writing quality");
  });

  it("includes title when provided without template", () => {
    const prompt = buildReviewPrompt("Content", { title: "My Document" });
    expect(prompt).toContain("My Document");
  });
});

describe("parseSuggestions", () => {
  it("parses valid JSON array", () => {
    const json = JSON.stringify([
      { original: "foo", suggested: "bar", rationale: "better" },
    ]);
    const result = parseSuggestions(json);
    expect(result).toHaveLength(1);
    expect(result[0].original).toBe("foo");
  });

  it("parses JSON inside code fences", () => {
    const text = '```json\n[{"original":"a","suggested":"b","rationale":"c"}]\n```';
    const result = parseSuggestions(text);
    expect(result).toHaveLength(1);
  });

  it("returns empty array for invalid JSON", () => {
    expect(parseSuggestions("not json")).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(parseSuggestions("[]")).toEqual([]);
  });

  it("filters out malformed items", () => {
    const json = JSON.stringify([
      { original: "foo", suggested: "bar", rationale: "ok" },
      { original: "missing" },
    ]);
    const result = parseSuggestions(json);
    expect(result).toHaveLength(1);
  });
});

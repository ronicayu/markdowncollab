import { describe, it, expect } from "vitest";
import { templates, getTemplateById, substituteVariables } from "../templates";
import type { Template } from "../templates";

describe("templates", () => {
  it("exports an array of at least 7 templates", () => {
    expect(templates.length).toBeGreaterThanOrEqual(7);
  });

  it("every template has required fields", () => {
    for (const t of templates) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(typeof t.content).toBe("string");
    }
  });

  it("blank template has empty content", () => {
    const blank = templates.find((t) => t.id === "blank");
    expect(blank).toBeDefined();
    expect(blank!.content).toBe("");
  });

  it("all template ids are unique", () => {
    const ids = templates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("templates with content contain valid markdown (no HTML tags)", () => {
    for (const t of templates) {
      if (t.content) {
        expect(t.content).not.toMatch(/<[a-z][^>]*>/i);
      }
    }
  });
});

describe("getTemplateById", () => {
  it("returns a template when id matches", () => {
    const t = getTemplateById("meeting-notes");
    expect(t).toBeDefined();
    expect(t!.name).toBe("Meeting Notes");
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });
});

describe("substituteVariables", () => {
  it("replaces {{date}} with YYYY-MM-DD format", () => {
    const result = substituteVariables("Today is {{date}}.");
    expect(result).toMatch(/Today is \d{4}-\d{2}-\d{2}\./);
  });

  it("replaces multiple {{date}} occurrences", () => {
    const result = substituteVariables("{{date}} and {{date}}");
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(`${today} and ${today}`);
  });

  it("returns content unchanged when no variables present", () => {
    expect(substituteVariables("Hello world")).toBe("Hello world");
  });

  it("handles empty string", () => {
    expect(substituteVariables("")).toBe("");
  });
});

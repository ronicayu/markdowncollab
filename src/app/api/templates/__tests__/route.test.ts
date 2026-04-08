import { describe, it, expect } from "vitest";
import { GET } from "../route";

describe("GET /api/templates", () => {
  it("returns 200 with an array of templates", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(7);
  });

  it("each template has id, name, description, icon and content for preview", async () => {
    const response = await GET();
    const data = await response.json();
    for (const t of data) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t).toHaveProperty("content");
    }
  });
});

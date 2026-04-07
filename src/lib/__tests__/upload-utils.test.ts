import { describe, it, expect } from "vitest";
import { validateImageFile, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "../upload-utils";

describe("validateImageFile", () => {
  it("accepts a valid PNG file", () => {
    const result = validateImageFile("image/png", 1024);
    expect(result).toEqual({ valid: true, error: null });
  });

  it("accepts a valid JPEG file", () => {
    const result = validateImageFile("image/jpeg", 2 * 1024 * 1024);
    expect(result).toEqual({ valid: true, error: null });
  });

  it("accepts a valid GIF file", () => {
    const result = validateImageFile("image/gif", 500);
    expect(result).toEqual({ valid: true, error: null });
  });

  it("accepts a valid WebP file", () => {
    const result = validateImageFile("image/webp", 100000);
    expect(result).toEqual({ valid: true, error: null });
  });

  it("rejects SVG files to prevent XSS", () => {
    const result = validateImageFile("image/svg+xml", 8000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("not supported");
  });

  it("rejects an unsupported MIME type", () => {
    const result = validateImageFile("application/pdf", 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File type");
  });

  it("rejects a file exceeding MAX_FILE_SIZE", () => {
    const result = validateImageFile("image/png", MAX_FILE_SIZE + 1);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("5MB");
  });

  it("accepts a file at exactly MAX_FILE_SIZE", () => {
    const result = validateImageFile("image/png", MAX_FILE_SIZE);
    expect(result).toEqual({ valid: true, error: null });
  });

  it("rejects empty MIME type", () => {
    const result = validateImageFile("", 1024);
    expect(result.valid).toBe(false);
  });

  it("exports ALLOWED_MIME_TYPES containing expected types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/gif");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_MIME_TYPES).not.toContain("image/svg+xml");
  });
});

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(
  mimeType: string,
  size: number
): { valid: boolean; error: string | null } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type "${mimeType}" is not supported. Allowed: PNG, JPG, GIF, WebP, SVG.`,
    };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds 5MB limit.`,
    };
  }
  return { valid: true, error: null };
}

/**
 * Get the file extension from a MIME type.
 */
export function extensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return map[mimeType] || "bin";
}

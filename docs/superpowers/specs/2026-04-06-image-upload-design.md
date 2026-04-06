# Image Upload & Display

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Required for product specs, bug reports, design docs

## Problem

No way to embed images. Users can't include screenshots, diagrams, mockups, or photos in documents. This limits the app to text-only content, which is insufficient for product specs, bug reports, and design discussions.

## Design

### Approach

Local file storage with Tiptap's Image extension. Images uploaded to the server, stored in a `uploads/` directory, served as static files. No external storage (S3) for v1 — keeps infrastructure simple.

### Dependencies

```bash
npm install @tiptap/extension-image
```

### Storage

- Images stored in `uploads/{documentId}/{uuid}.{ext}`
- Served via a static file route or API endpoint
- Max file size: 5MB
- Accepted formats: PNG, JPG, GIF, WebP, SVG

### API

**`POST /api/documents/[id]/upload`**
- Accepts `multipart/form-data` with a `file` field
- Validates file type and size
- Saves to `uploads/{documentId}/{uuid}.{ext}`
- Returns `{ url: "/api/documents/{id}/uploads/{filename}" }`
- Requires editor role

**`GET /api/documents/[id]/uploads/[filename]`**
- Serves the uploaded file with appropriate Content-Type
- Requires viewer role (images visible to anyone who can view the doc)

### Editor Integration

Add `Image` extension to Editor.tsx:
```typescript
Image.configure({
  allowBase64: false,
  HTMLAttributes: { class: 'editor-image' },
})
```

### Upload UI

Two methods:
1. **Slash command `/image`** — Opens file picker dialog
2. **Paste** — Intercept paste events containing images, upload automatically

Both methods:
1. Show loading placeholder in editor
2. Upload file to API
3. Replace placeholder with image node pointing to the URL

### Image Styling

```css
.editor-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1rem 0;
}
.editor-image.ProseMirror-selectednode {
  outline: 2px solid #b4783c;
}
```

### Markdown Export

Export images as standard markdown: `![alt text](url)`

### Collaboration

Image nodes work with Yjs. The URL is stored in the node attributes, which sync to all clients. The actual file is on the server, so all clients can load it.

### Cleanup

When a document is deleted (DELETE /api/documents/[id]), also delete the `uploads/{documentId}/` directory. Add this to the existing delete handler.

## Team Debate Notes

**SWE 2 challenged:** "Local storage won't scale. Should we use S3?"
**SWE 1 response:** "For a 10-person team, local storage is fine. `uploads/` on the server handles thousands of images. S3 is premature optimization. We can add it as a storage backend later without changing the API contract."
**Consensus:** Local storage for v1. API abstraction makes it easy to swap backends.

**QE challenged:** "What about image resize?"
**PM response:** "Skip resize for v1. Max-width: 100% is sufficient. Resize is a UX rabbit hole."
**Consensus:** No resize. CSS max-width handles display.

## Testing Strategy

- Unit test file validation (type, size)
- API test: upload file, verify stored, verify served
- Test image cleanup on document deletion
- E2E test: upload image via slash command, verify it appears

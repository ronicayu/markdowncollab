# Image Upload & Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add image upload, display, and markdown export to the editor.

**Architecture:** Local file storage in uploads/{docId}/. Upload API endpoint. @tiptap/extension-image for editor integration. Slash command /image and paste-to-upload.

**Tech Stack:** @tiptap/extension-image, multer or formidable, Node.js fs

---

## File Map

| File | Change |
|---|---|
| `package.json` | Modified -- add @tiptap/extension-image |
| `src/lib/upload-utils.ts` | New -- file validation (type, size), UUID generation |
| `src/lib/__tests__/upload-utils.test.ts` | New -- unit tests for file validation |
| `src/app/api/documents/[id]/upload/route.ts` | New -- POST endpoint for image upload |
| `src/app/api/documents/[id]/uploads/[filename]/route.ts` | New -- GET endpoint to serve uploaded images |
| `src/components/Editor.tsx` | Modified -- add Image extension, paste-to-upload handler |
| `src/components/SlashCommandMenu.tsx` | Modified -- add /image command |
| `src/app/globals.css` | Modified -- add image styles |
| `src/lib/export-markdown.ts` | Modified -- handle image node export |
| `server/combined-server.mjs` | Modified -- handle image node in server-side markdown export |
| `src/app/api/documents/[id]/route.ts` | Modified -- delete uploads directory on document delete |
| `.gitignore` | Modified -- add uploads/ directory |

---

## Task 1: Install Image Extension

**Files:**
- Modified: `package.json`

- [ ] **Step 1: Install @tiptap/extension-image**

```bash
npm install @tiptap/extension-image
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @tiptap/extension-image"
```

---

## Task 2: Upload Validation Utility -- Tests First

**Files:**
- Create: `src/lib/__tests__/upload-utils.test.ts`
- Create: `src/lib/upload-utils.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/__tests__/upload-utils.test.ts`:

```ts
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

  it("accepts a valid SVG file", () => {
    const result = validateImageFile("image/svg+xml", 8000);
    expect(result).toEqual({ valid: true, error: null });
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
    expect(ALLOWED_MIME_TYPES).toContain("image/svg+xml");
  });
});
```

- [ ] **Step 2: Create the upload-utils module**

Create `src/lib/upload-utils.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests -- they should pass**

```bash
npx vitest run src/lib/__tests__/upload-utils.test.ts
```

All 10 tests should pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/upload-utils.ts src/lib/__tests__/upload-utils.test.ts
git commit -m "feat: add image upload validation utility with tests"
```

---

## Task 3: Image Upload API Endpoint

**Files:**
- Create: `src/app/api/documents/[id]/upload/route.ts`

- [ ] **Step 1: Create the upload route**

Create `src/app/api/documents/[id]/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { validateImageFile, extensionFromMime } from "@/lib/upload-utils";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null,
    undefined,
    "editor"
  );
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file
  const validation = validateImageFile(file.type, file.size);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Create upload directory for this document
  const docUploadsDir = join(UPLOADS_DIR, id);
  await mkdir(docUploadsDir, { recursive: true });

  // Generate unique filename
  const ext = extensionFromMime(file.type);
  const filename = `${randomUUID()}.${ext}`;
  const filePath = join(docUploadsDir, filename);

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Return the URL that can be used to serve the file
  const url = `/api/documents/${id}/uploads/${filename}`;

  return NextResponse.json({ url });
}
```

- [ ] **Step 2: Commit**

```bash
git add -f src/app/api/documents/[id]/upload/route.ts
git commit -m "feat: add image upload API endpoint"
```

---

## Task 4: Image Serving API Endpoint

**Files:**
- Create: `src/app/api/documents/[id]/uploads/[filename]/route.ts`

- [ ] **Step 1: Create the image serving route**

Create `src/app/api/documents/[id]/uploads/[filename]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";

const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  // Auth check -- viewer role is sufficient to see images
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null
  );
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Sanitize filename to prevent path traversal
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (sanitized !== filename) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const filePath = join(UPLOADS_DIR, id, sanitized);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const ext = sanitized.split(".").pop()?.toLowerCase() || "";
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add -f src/app/api/documents/[id]/uploads/[filename]/route.ts
git commit -m "feat: add image serving API endpoint with cache headers"
```

---

## Task 5: Add uploads/ to .gitignore

**Files:**
- Modified: `.gitignore`

- [ ] **Step 1: Add uploads directory to .gitignore**

Add this line to the end of `.gitignore`:

```
uploads/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add uploads/ to .gitignore"
```

---

## Task 6: Register Image Extension and Paste-to-Upload

**Files:**
- Modified: `src/components/Editor.tsx`

- [ ] **Step 1: Add Image extension import**

In `src/components/Editor.tsx`, add this import after the existing extension imports:

```ts
import Image from "@tiptap/extension-image";
```

- [ ] **Step 2: Add Image extension to the extensions array**

In the `useEditor` call, add the Image extension to the `extensions` array. Insert it after the `Markdown` extension configuration (after line 131):

```ts
      Image.configure({
        allowBase64: false,
        HTMLAttributes: { class: "editor-image" },
      }),
```

- [ ] **Step 3: Add the upload helper function**

Add this function inside the `Editor` component, before the `useEditor` call (after the state declarations):

```ts
  async function uploadImage(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`/api/documents/${_documentId}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Upload failed:", err.error);
        return null;
      }
      const data = await res.json();
      return data.url;
    } catch (err) {
      console.error("Upload error:", err);
      return null;
    }
  }
```

Note: The `_documentId` prop is already available (it was renamed with underscore prefix on line 55). Change it back to `documentId` by updating the destructuring:

Replace:
```ts
  documentId: _documentId,
```
with:
```ts
  documentId,
```

And update the reference in the `_documentId` usage to `documentId`.

- [ ] **Step 4: Add paste-to-upload handler**

In the `editorProps.handlePaste` function, add image paste handling at the beginning of the function (before the existing bullet list paste logic). Replace the entire `handlePaste` function:

```ts
      handlePaste(view, event) {
        // Handle image paste
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;

              // Insert placeholder
              const { state } = view;
              const placeholderText = "Uploading image...";
              const tr = state.tr.insertText(placeholderText);
              const placeholderFrom = state.selection.from;
              const placeholderTo = placeholderFrom + placeholderText.length;
              view.dispatch(tr);

              // Upload and replace
              uploadImage(file).then((url) => {
                if (url) {
                  // Remove placeholder and insert image
                  const currentState = view.state;
                  const removeTr = currentState.tr.delete(placeholderFrom, placeholderTo);
                  view.dispatch(removeTr);

                  // Use editor chain to insert image node
                  editorRef?.chain().focus().setImage({ src: url }).run();
                } else {
                  // Remove placeholder on failure
                  const currentState = view.state;
                  const removeTr = currentState.tr.delete(placeholderFrom, placeholderTo);
                  view.dispatch(removeTr);
                }
              });
              return true;
            }
          }
        }

        // Handle plain-text markdown-style list paste (existing logic)
        const text = event.clipboardData?.getData('text/plain') || '';
        const lines = text.split('\n').filter(l => l.trim() !== '');
        const allBullets = lines.length > 0 && lines.every(l => /^[-*]\s/.test(l));
        if (allBullets) {
          const items = lines.map(l => l.replace(/^[-*]\s/, '').trim());
          const { schema } = view.state;
          const bulletListType = schema.nodes.bulletList;
          const listItemType = schema.nodes.listItem;
          const paragraphType = schema.nodes.paragraph;
          if (bulletListType && listItemType && paragraphType) {
            const listItems = items.map(item =>
              listItemType.create(null, paragraphType.create(null, item ? schema.text(item) : [])
            ));
            const bulletList = bulletListType.create(null, listItems);
            const { tr } = view.state;
            const insertTr = tr.replaceSelectionWith(bulletList);
            view.dispatch(insertTr);
            return true;
          }
        }
        return false;
      },
```

- [ ] **Step 5: Add an editor ref for image insertion**

Add a ref to capture the editor instance. After the state declarations (after the `wordCount` state), add:

```ts
  const editorRef = useRef<TiptapEditor | null>(null);
```

Add `useRef` to the React import if not already there. Then in the `useEditor` callback or after the editor is created, set the ref. The simplest approach: after the `const editor = useEditor(...)` call, add:

```ts
  // Keep a ref for use in paste handler closures
  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);
```

Actually, a simpler approach avoids the stale closure issue. Instead of using `editorRef` in the paste handler, restructure the paste handler to use the `editor` variable directly by moving the upload logic outside the paste handler. Replace the image paste section with:

```ts
        // Handle image paste
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;

              uploadImage(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
              return true;
            }
          }
        }
```

This is simpler -- no placeholder, just insert the image when the upload completes. The editor variable is captured via the useEditor closure which stays current.

However, since `handlePaste` is inside `editorProps` which is passed to `useEditor`, and `editor` is the return value of `useEditor`, we have a circular reference. Instead, use `view.state` from the paste handler and dispatch an image insert transaction directly:

```ts
        // Handle image paste
        const pasteItems = event.clipboardData?.items;
        if (pasteItems) {
          for (const item of Array.from(pasteItems)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (!file) return true;

              uploadImage(file).then((url) => {
                if (url) {
                  const { schema } = view.state;
                  const imageNode = schema.nodes.image;
                  if (imageNode) {
                    const node = imageNode.create({ src: url });
                    const tr = view.state.tr.replaceSelectionWith(node);
                    view.dispatch(tr);
                  }
                }
              });
              return true;
            }
          }
        }
```

This approach uses the `view` parameter which is always current.

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: add Image extension with paste-to-upload support"
```

---

## Task 7: Add /image Slash Command

**Files:**
- Modified: `src/components/SlashCommandMenu.tsx`

- [ ] **Step 1: Add image command to the COMMANDS array**

In `src/components/SlashCommandMenu.tsx`, add a new command entry to the `COMMANDS` array. Insert it after the `divider` command:

```ts
  {
    id: "image",
    label: "Image",
    description: "Upload an image",
    icon: "🖼",
    keywords: ["image", "picture", "photo", "upload", "img"],
    action: (editor) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        // Extract document ID from URL: /doc/{id}
        const docId = window.location.pathname.split("/doc/")[1]?.split("/")[0] || "";
        if (!docId) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(`/api/documents/${docId}/upload`, {
            method: "POST",
            body: formData,
          });
          if (!res.ok) {
            console.error("Upload failed");
            return;
          }
          const data = await res.json();
          editor.chain().focus().setImage({ src: data.url }).run();
        } catch (err) {
          console.error("Upload error:", err);
        }
      };
      input.click();
    },
  },
```

- [ ] **Step 2: Test the slash command**

Run the dev server, type `/image`, select the command, choose a file, and confirm the image appears in the editor.

- [ ] **Step 3: Commit**

```bash
git add src/components/SlashCommandMenu.tsx
git commit -m "feat: add /image slash command with file picker"
```

---

## Task 8: Image CSS Styles

**Files:**
- Modified: `src/app/globals.css`

- [ ] **Step 1: Add image styles to globals.css**

Add these styles after the table styles (or after the `.ProseMirror hr` rule):

```css
/* Image styles */
.ProseMirror .editor-image {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  margin: 1rem 0;
  display: block;
}
.ProseMirror .editor-image.ProseMirror-selectednode {
  outline: 2px solid #b4783c;
  outline-offset: 2px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add image display styles"
```

---

## Task 9: Image Markdown Export

**Files:**
- Modified: `src/lib/export-markdown.ts`
- Modified: `server/combined-server.mjs`

- [ ] **Step 1: Add image export to client-side export-markdown.ts**

In `src/lib/export-markdown.ts`, in the `xmlFragmentToMarkdown` function, add a new `else if` branch for the `"image"` tag. Insert it after the `horizontalRule` branch (after `md += "---\n\n";`) and before the `else` fallback:

```ts
      } else if (tag === "image") {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "";
        md += `![${alt}](${src})\n\n`;
```

- [ ] **Step 2: Add image export to server-side combined-server.mjs**

In `server/combined-server.mjs`, in the `xmlFragmentToMarkdown` function, add the same branch. Insert it after the `horizontalRule` branch (after `md += "---\n\n";`) and before the `else` fallback:

```js
      } else if (tag === "image") {
        const src = child.getAttribute("src") || "";
        const alt = child.getAttribute("alt") || "";
        md += `![${alt}](${src})\n\n`;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/export-markdown.ts server/combined-server.mjs
git commit -m "feat: add image markdown export as ![alt](url)"
```

---

## Task 10: Cleanup Uploads on Document Delete

**Files:**
- Modified: `src/app/api/documents/[id]/route.ts`

- [ ] **Step 1: Add upload directory cleanup to the DELETE handler**

In `src/app/api/documents/[id]/route.ts`, add an import for `rm` at the top:

```ts
import { unlink, rm } from "fs/promises";
```

Then in the `DELETE` function, after the existing `Promise.allSettled` call that deletes `.bin` and `.md` files, add the uploads directory cleanup. Replace the existing cleanup block:

```ts
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
  ]);
```

with:

```ts
  const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
    rm(join(UPLOADS_DIR, id), { recursive: true, force: true }),
  ]);
```

- [ ] **Step 2: Commit**

```bash
git add -f src/app/api/documents/[id]/route.ts
git commit -m "feat: delete uploads directory when document is deleted"
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test /image slash command**

1. Open a document at http://100.109.228.117:3000/
2. Type `/image` and select the Image command
3. Choose a PNG or JPG file under 5MB
4. Confirm the image appears in the editor
5. Check that the file exists in `uploads/{docId}/`

- [ ] **Step 3: Test paste-to-upload**

1. Copy an image to the clipboard (e.g., screenshot)
2. Paste into the editor (Cmd+V)
3. Confirm the image appears in the editor after a brief upload

- [ ] **Step 4: Test image persistence across reload**

1. Upload an image
2. Refresh the page
3. Confirm the image still appears (URL loads from the server)

- [ ] **Step 5: Test file validation**

1. Try uploading a file larger than 5MB -- should be rejected
2. Try uploading a non-image file (e.g., .txt) -- should be rejected

- [ ] **Step 6: Test markdown export**

Check the `documents/{docId}.md` file and confirm images export as `![](url)`.

- [ ] **Step 7: Test document deletion cleanup**

1. Upload an image to a test document
2. Delete the document
3. Confirm the `uploads/{docId}/` directory is removed

- [ ] **Step 8: Run the full test suite**

```bash
npm run test
```

Ensure no regressions.

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat: image upload and display -- slash command, paste, export, cleanup"
```

---

## Verification Checklist

- [ ] @tiptap/extension-image installed and registered (no console errors)
- [ ] `/image` slash command opens file picker and uploads selected file
- [ ] Paste-to-upload works for clipboard images
- [ ] Uploaded images display in the editor with max-width: 100%
- [ ] Selected images show an outline highlight
- [ ] Image files are stored in `uploads/{docId}/{uuid}.{ext}`
- [ ] Image serving endpoint returns correct Content-Type and cache headers
- [ ] File validation rejects files over 5MB
- [ ] File validation rejects non-image MIME types
- [ ] Markdown export produces `![alt](url)` syntax
- [ ] Server-side markdown persistence includes image export
- [ ] Document deletion removes the uploads directory
- [ ] Images persist across page reload (URL-based, not base64)
- [ ] Images sync to other collaborators via Yjs (URL in node attrs)
- [ ] All existing tests pass (no regressions)
- [ ] Upload utility tests pass

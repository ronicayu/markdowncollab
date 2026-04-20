# Document Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add built-in document templates (Meeting Notes, ADR, RFC, Standup, Project Brief, Bug Report) with a template picker on document creation.

**Architecture:** Templates defined as code in src/lib/templates.ts. Template picker modal on document list page. Template content injected into Yjs doc after creation via tiptap-markdown.

**Tech Stack:** React, Tailwind, tiptap-markdown

---

## Task 1: Template definitions with tests

**File:** `src/lib/templates.ts`
**Test file:** `src/lib/__tests__/templates.test.ts`
**Time estimate:** 5 minutes

- [ ] 1.1. Create `src/lib/__tests__/` directory (if it does not exist) and write tests first in `src/lib/__tests__/templates.test.ts`:

```typescript
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
```

- [ ] 1.2. Create `src/lib/templates.ts` with the Template interface, all 7 templates, and helper functions:

```typescript
export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string;
}

export const templates: Template[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Start from scratch",
    icon: "📄",
    content: "",
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, discussion, and action items",
    icon: "📋",
    content: `# Meeting Notes

**Date:** {{date}}
**Attendees:**

## Agenda

1.

## Discussion



## Action Items

- [ ]
`,
  },
  {
    id: "adr",
    name: "ADR",
    description: "Architecture Decision Record",
    icon: "🏗️",
    content: `# ADR: [Title]

**Date:** {{date}}
**Status:** Proposed

## Context

[What is the issue that we're seeing that is motivating this decision?]

## Decision

[What is the change that we're proposing and/or doing?]

## Consequences

[What becomes easier or more difficult to do because of this change?]
`,
  },
  {
    id: "rfc",
    name: "RFC",
    description: "Request for Comments",
    icon: "💬",
    content: `# RFC: [Title]

**Author:**
**Date:** {{date}}
**Status:** Draft

## Summary

[One-paragraph summary of the proposal.]

## Motivation

[Why are we doing this? What problem does it solve?]

## Detailed Design

[Explain the design in enough detail for someone familiar with the codebase to understand.]

## Alternatives Considered

[What other approaches were considered and why were they not chosen?]

## Open Questions

-
`,
  },
  {
    id: "standup",
    name: "Standup Update",
    description: "Yesterday, today, blockers",
    icon: "🧍",
    content: `# Standup — {{date}}

## Yesterday

-

## Today

-

## Blockers

-
`,
  },
  {
    id: "project-brief",
    name: "Project Brief",
    description: "Objective, scope, timeline, stakeholders",
    icon: "🎯",
    content: `# Project Brief: [Title]

**Date:** {{date}}
**Owner:**

## Objective

[What are we trying to achieve?]

## Scope

[What is included and excluded?]

## Timeline

| Milestone | Date |
| --------- | ---- |
|           |      |

## Stakeholders

-

## Risks

-
`,
  },
  {
    id: "bug-report",
    name: "Bug Report",
    description: "Steps to reproduce, expected vs actual",
    icon: "🐛",
    content: `# Bug Report: [Title]

**Date:** {{date}}
**Severity:** [Critical / High / Medium / Low]
**Reporter:**

## Summary

[Brief description of the bug.]

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

[What should happen?]

## Actual Behavior

[What actually happens?]

## Environment

- Browser:
- OS:
- Version:
`,
  },
];

export function getTemplateById(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

export function substituteVariables(content: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return content.replace(/\{\{date\}\}/g, today);
}
```

- [ ] 1.3. Run tests to verify:

```bash
npx vitest run src/lib/__tests__/templates.test.ts
```

- [ ] 1.4. Commit:

```bash
git add src/lib/templates.ts src/lib/__tests__/templates.test.ts
git commit -m "feat: add template definitions with tests

Define 7 built-in document templates (Blank, Meeting Notes, ADR, RFC,
Standup, Project Brief, Bug Report) with variable substitution for {{date}}."
```

---

## Task 2: Templates API endpoint

**File:** `src/app/api/templates/route.ts`
**Test file:** `src/app/api/templates/__tests__/route.test.ts`
**Time estimate:** 3 minutes

- [ ] 2.1. Write tests first in `src/app/api/templates/__tests__/route.test.ts`:

```typescript
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

  it("each template has id, name, description, icon but not content", async () => {
    const response = await GET();
    const data = await response.json();
    for (const t of data) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t).not.toHaveProperty("content");
    }
  });
});
```

- [ ] 2.2. Create `src/app/api/templates/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { templates } from "@/lib/templates";

export async function GET() {
  const list = templates.map(({ id, name, description, icon }) => ({
    id,
    name,
    description,
    icon,
  }));
  return NextResponse.json(list);
}
```

- [ ] 2.3. Run tests to verify:

```bash
npx vitest run src/app/api/templates/__tests__/route.test.ts
```

- [ ] 2.4. Modify `src/app/api/documents/route.ts` POST handler to accept `templateId` and return `templateContent` in the response:

Update the POST function to:

```typescript
export async function POST(req: Request) {
  const { title, templateId } = await req.json();
  const doc = await prisma.document.create({
    data: { title: title || "Untitled" },
  });

  let templateContent: string | null = null;
  if (templateId) {
    const { getTemplateById, substituteVariables } = await import("@/lib/templates");
    const template = getTemplateById(templateId);
    if (template && template.content) {
      templateContent = substituteVariables(template.content);
    }
  }

  return NextResponse.json({ ...doc, templateContent }, { status: 201 });
}
```

- [ ] 2.5. Run all tests to confirm nothing is broken:

```bash
npx vitest run
```

- [ ] 2.6. Commit:

```bash
git add src/app/api/templates/route.ts src/app/api/templates/__tests__/route.test.ts src/app/api/documents/route.ts
git commit -m "feat: add GET /api/templates endpoint and templateId support in POST /api/documents

Templates API returns id/name/description/icon (no content).
Document creation accepts optional templateId and returns substituted
template content for client-side injection."
```

---

## Task 3: Template picker modal component

**File:** `src/components/TemplatePicker.tsx`
**Test file:** `src/components/__tests__/TemplatePicker.test.tsx`
**Time estimate:** 5 minutes

- [ ] 3.1. Write tests first in `src/components/__tests__/TemplatePicker.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TemplatePicker from "../TemplatePicker";

const mockTemplates = [
  { id: "blank", name: "Blank", description: "Start from scratch", icon: "📄" },
  { id: "meeting-notes", name: "Meeting Notes", description: "Agenda and action items", icon: "📋" },
];

describe("TemplatePicker", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTemplates),
    }) as unknown as typeof fetch;
  });

  it("renders template cards after loading", async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker open={true} onClose={vi.fn()} onSelect={onSelect} />);
    await waitFor(() => {
      expect(screen.getByText("Blank")).toBeInTheDocument();
      expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
    });
  });

  it("calls onSelect with template id when a card is clicked", async () => {
    const onSelect = vi.fn();
    render(<TemplatePicker open={true} onClose={vi.fn()} onSelect={onSelect} />);
    await waitFor(() => expect(screen.getByText("Meeting Notes")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Meeting Notes"));
    expect(onSelect).toHaveBeenCalledWith("meeting-notes");
  });

  it("calls onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<TemplatePicker open={true} onClose={onClose} onSelect={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Blank")).toBeInTheDocument());
    fireEvent.click(screen.getByTestId("template-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render when open is false", () => {
    render(<TemplatePicker open={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByText("Choose a template")).not.toBeInTheDocument();
  });
});
```

- [ ] 3.2. Create `src/components/TemplatePicker.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (templateId: string) => void;
}

export default function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/templates")
      .then((r) => r.json())
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      data-testid="template-picker-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Choose a template</h2>
        <p className="text-sm text-gray-500 mb-4">Start with a structure or go blank.</p>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg px-4 py-3 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelect(t.id)}
                className="flex items-start gap-3 text-left bg-[#ffffff] rounded-lg px-4 py-3 border border-transparent hover:border-[#0075de] hover:shadow-sm transition-all group"
              >
                <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm group-hover:text-[#0075de] transition-colors">
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] 3.3. Run tests to verify:

```bash
npx vitest run src/components/__tests__/TemplatePicker.test.tsx
```

- [ ] 3.4. Commit:

```bash
git add src/components/TemplatePicker.tsx src/components/__tests__/TemplatePicker.test.tsx
git commit -m "feat: add TemplatePicker modal component

Grid of template cards with icon, name, and description. Fetches
template list from /api/templates. Fires onSelect with template id
on click."
```

---

## Task 4: Document list integration — replace "New Document" button

**File:** `src/app/page.tsx`
**Time estimate:** 4 minutes

- [ ] 4.1. Add state for template picker modal. At the top of the `Home` component (after existing state declarations around line 41), add:

```typescript
const [showTemplatePicker, setShowTemplatePicker] = useState(false);
```

- [ ] 4.2. Add the import for TemplatePicker at the top of the file:

```typescript
import TemplatePicker from "@/components/TemplatePicker";
```

- [ ] 4.3. Create a new `createDocFromTemplate` function (replace the existing `createDoc` function body or add alongside it). The new function accepts a `templateId`:

Replace the existing `createDoc` function with:

```typescript
async function createDocFromTemplate(templateId: string) {
  setCreating(true);
  setShowTemplatePicker(false);
  try {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Untitled",
        templateId: templateId === "blank" ? undefined : templateId,
      }),
    });
    const doc = await res.json();
    if (doc.templateContent) {
      sessionStorage.setItem(`template:${doc.id}`, doc.templateContent);
    }
    router.push(`/doc/${doc.id}`);
  } finally {
    setCreating(false);
  }
}
```

- [ ] 4.4. Update the "New Document" button in the header (around line 274) to open the template picker instead of calling `createDoc` directly. Change `onClick={createDoc}` to `onClick={() => setShowTemplatePicker(true)}`.

- [ ] 4.5. Update the empty-state "Create your first document" button (around line 316) similarly: change `onClick={createDoc}` to `onClick={() => setShowTemplatePicker(true)}`.

- [ ] 4.6. Add the TemplatePicker component before the closing `</div>` of the return statement (just before the delete confirmation modal around line 426):

```tsx
<TemplatePicker
  open={showTemplatePicker}
  onClose={() => setShowTemplatePicker(false)}
  onSelect={createDocFromTemplate}
/>
```

- [ ] 4.7. Run the dev server and manually verify the template picker opens when clicking "New Document":

```bash
npm run dev
```

- [ ] 4.8. Commit:

```bash
git add src/app/page.tsx
git commit -m "feat: integrate template picker into document list page

Replace direct document creation with template picker modal. Selected
template content is stored in sessionStorage for the editor to pick up
after navigation."
```

---

## Task 5: Editor integration — apply template content on load

**File:** `src/app/doc/[id]/page.tsx`
**Time estimate:** 4 minutes

- [ ] 5.1. In `src/app/doc/[id]/page.tsx`, update the `handleEditorReady` callback (around line 383) to check sessionStorage for template content and inject it using `tiptap-markdown`. Replace the existing `handleEditorReady`:

```typescript
const handleEditorReady = useCallback(
  (e: import("@tiptap/core").Editor) => {
    setEditor(e);
    setActiveCommentIds(collectActiveCommentIds(e));
    e.on("update", () => setActiveCommentIds(collectActiveCommentIds(e)));

    // Check for template content stored by the document list page
    const templateKey = `template:${id}`;
    const templateContent = sessionStorage.getItem(templateKey);
    if (templateContent) {
      sessionStorage.removeItem(templateKey);
      // Wait a tick for Yjs sync to initialize, then inject template
      // only if the document is empty (no existing content)
      setTimeout(() => {
        const docText = e.state.doc.textContent.trim();
        if (!docText) {
          // Use tiptap-markdown to parse markdown into ProseMirror content
          const { Markdown } = require("tiptap-markdown");
          const tempEditor = new (require("@tiptap/core").Editor)({
            extensions: [
              require("@tiptap/starter-kit").default,
              Markdown,
            ],
          });
          tempEditor.commands.setContent(templateContent);
          // This is a Markdown extension approach - but simpler: use insertContent with HTML
          // Actually, tiptap-markdown adds a storage.markdown.getMarkdown() / setContent method
          // Simpler approach: use the editor's built-in markdown parsing if Markdown extension is present
          // Fallback: convert markdown to HTML manually for insertion
          e.commands.setContent(markdownToHtml(templateContent));
        }
        e.commands.focus("end");
      }, 200);
    } else {
      setTimeout(() => e.commands.focus("end"), 100);
    }
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [id]
);
```

**Wait** -- the codebase already has `tiptap-markdown` as a dependency but does not import it in the Editor. A simpler approach: convert markdown to minimal HTML for `setContent`. Add a helper function in the doc page file:

- [ ] 5.1 (revised). Add a `markdownToHtml` helper at the top of `src/app/doc/[id]/page.tsx` (after imports, before the component):

```typescript
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- \[ \] (.+)$/gm, "<ul data-type=\"taskList\"><li data-type=\"taskItem\" data-checked=\"false\"><p>$1</p></li></ul>")
    .replace(/^- (.+)$/gm, "<li><p>$1</p></li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li><p>$2</p></li>")
    .replace(/\| .+ \|/g, (match) => `<p>${match}</p>`)
    .replace(/^(?!<[a-z])((?!\n).+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "<p></p>")
    .replace(/\n{2,}/g, "");
}
```

**Actually, this is fragile.** Better approach: use the `Markdown` extension from `tiptap-markdown` which is already installed. Add it to the Editor component's extensions and use `editor.commands.setContent(markdownString)` which the Markdown extension handles automatically.

- [ ] 5.1 (final approach). Modify `src/components/Editor.tsx` to include the Markdown extension from `tiptap-markdown`. Add the import at the top of the file:

```typescript
import { Markdown } from "tiptap-markdown";
```

Add `Markdown` to the extensions array in the `useEditor` call (after `Collaboration.configure(...)` around line 113):

```typescript
Markdown.configure({
  html: true,
  transformPastedText: false,
  transformCopiedText: false,
}),
```

- [ ] 5.2. Update the `EditorProps` interface in `src/components/Editor.tsx` to accept optional initial markdown content:

```typescript
interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  onEditorReady?: (editor: TiptapEditor) => void;
  activeCommentId?: string | null;
  initialContent?: string | null;
}
```

Update the component destructuring to include `initialContent`:

```typescript
export default function Editor({
  documentId: _documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  initialContent,
}: EditorProps) {
```

- [ ] 5.3. Add a `useEffect` in `src/components/Editor.tsx` to inject the template content once the editor is ready and the document is empty. Add after the existing `useEffect` that calls `onEditorReady` (around line 218):

```typescript
// Inject template content into empty document
const [templateApplied, setTemplateApplied] = useState(false);
```

(Add `templateApplied` state near the other `useState` declarations at the top of the component.)

Then add the effect:

```typescript
useEffect(() => {
  if (!editor || !initialContent || templateApplied) return;
  // Wait for Yjs to sync before checking emptiness
  const timer = setTimeout(() => {
    const text = editor.state.doc.textContent.trim();
    if (!text) {
      editor.commands.setContent(initialContent);
    }
    setTemplateApplied(true);
  }, 300);
  return () => clearTimeout(timer);
}, [editor, initialContent, templateApplied]);
```

- [ ] 5.4. In `src/app/doc/[id]/page.tsx`, read template content from sessionStorage and pass it to the Editor. Add state near other state declarations:

```typescript
const [templateContent, setTemplateContent] = useState<string | null>(null);
```

Add an effect to read and clear sessionStorage (after the `userName` effect):

```typescript
useEffect(() => {
  const key = `template:${id}`;
  const content = sessionStorage.getItem(key);
  if (content) {
    sessionStorage.removeItem(key);
    setTemplateContent(content);
  }
}, [id]);
```

- [ ] 5.5. Pass `initialContent` to the Editor component in `src/app/doc/[id]/page.tsx`. Update the `<Editor>` JSX (around line 563):

```tsx
<Editor
  documentId={id}
  userName={userName}
  ydoc={ydoc}
  provider={provider}
  onEditorReady={handleEditorReady}
  activeCommentId={activeCommentId}
  initialContent={templateContent}
/>
```

- [ ] 5.6. Run the dev server and manually test the full flow:
  1. Click "New Document" on the document list page
  2. Select "Meeting Notes" from the template picker
  3. Verify the editor opens with the Meeting Notes template pre-filled
  4. Verify `{{date}}` has been replaced with today's date
  5. Select "Blank" and verify the editor opens empty (current behavior)

```bash
npm run dev
```

- [ ] 5.7. Run all tests to confirm nothing is broken:

```bash
npx vitest run
```

- [ ] 5.8. Commit:

```bash
git add src/components/Editor.tsx src/app/doc/[id]/page.tsx
git commit -m "feat: apply template content when opening a new document

Add tiptap-markdown extension to Editor for markdown parsing. Read
template content from sessionStorage after navigation, inject into
empty Yjs document via setContent. Template is applied once and only
if the document has no existing content."
```

---

## Task 6: Template variable substitution ({{date}})

This is already implemented in Task 1 (`substituteVariables` in `src/lib/templates.ts`) and wired into the API in Task 2 (the POST `/api/documents` handler calls `substituteVariables` before returning `templateContent`). The tests in Task 1 cover this.

- [ ] 6.1. Verify end-to-end that `{{date}}` is substituted by running the full flow manually:
  1. Create a new document with the "Meeting Notes" template
  2. Confirm the date field shows today's date (e.g., `2026-04-06`) and not `{{date}}`
  3. Create a new document with the "Standup Update" template
  4. Confirm the heading shows `Standup — 2026-04-06`

- [ ] 6.2. Final full test suite run:

```bash
npx vitest run
```

- [ ] 6.3. Final commit (if any adjustments were needed):

```bash
git add -A
git commit -m "feat: document templates — complete feature

Built-in templates with variable substitution, template picker modal,
and editor integration for injecting template content into new documents."
```

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/templates.ts` | Create | Template definitions, `getTemplateById`, `substituteVariables` |
| `src/lib/__tests__/templates.test.ts` | Create | Unit tests for templates and variable substitution |
| `src/app/api/templates/route.ts` | Create | `GET /api/templates` — returns template list (no content) |
| `src/app/api/templates/__tests__/route.test.ts` | Create | Unit tests for templates API |
| `src/app/api/documents/route.ts` | Modify | Accept `templateId` in POST, return `templateContent` |
| `src/components/TemplatePicker.tsx` | Create | Modal with 2-column grid of template cards |
| `src/components/__tests__/TemplatePicker.test.tsx` | Create | Unit tests for TemplatePicker |
| `src/app/page.tsx` | Modify | Wire up template picker, store content in sessionStorage |
| `src/components/Editor.tsx` | Modify | Add tiptap-markdown extension, accept `initialContent` prop |
| `src/app/doc/[id]/page.tsx` | Modify | Read sessionStorage template, pass to Editor |

## Dependencies

No new dependencies needed. `tiptap-markdown` (v0.9.0) is already in `package.json`.

## Risk Notes

- **sessionStorage for template content:** This is ephemeral and tab-scoped, which is the correct behavior. Template content does not need to persist across tabs or page refreshes since it is only used during the create-then-navigate flow.
- **Race condition with Yjs sync:** The 300ms delay in the Editor effect gives Yjs time to sync. If the document already has content from another client, the template is not applied (guarded by the emptiness check).
- **tiptap-markdown setContent:** The Markdown extension from `tiptap-markdown` overrides `setContent` to accept markdown strings. This is the documented usage pattern for the library.

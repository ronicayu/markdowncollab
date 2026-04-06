# Document Templates

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P1 — Onboarding and productivity boost

## Problem

Every new document starts blank. Users have to recreate common structures (meeting notes, ADRs, RFCs) from scratch every time. Templates reduce friction and establish team conventions.

## Design

### Approach

Ship built-in templates as markdown strings. When a user creates a document from a template, inject the markdown into the Yjs doc. No database model needed for v1 — templates are code-defined.

### Built-in Templates

1. **Meeting Notes** — Date, attendees, agenda, discussion, action items
2. **ADR (Architecture Decision Record)** — Title, status, context, decision, consequences
3. **RFC (Request for Comments)** — Summary, motivation, detailed design, alternatives, open questions
4. **Standup Update** — Yesterday, today, blockers
5. **Project Brief** — Objective, scope, timeline, stakeholders, risks
6. **Bug Report** — Summary, steps to reproduce, expected/actual behavior, environment
7. **Blank** — Current behavior, always available

### Implementation

**New file: `src/lib/templates.ts`**
```typescript
export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  content: string; // markdown
}

export const templates: Template[] = [
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    description: "Agenda, discussion, and action items",
    icon: "📋",
    content: "# Meeting Notes\n\n**Date:** {{date}}\n**Attendees:**\n\n## Agenda\n\n1. \n\n## Discussion\n\n\n\n## Action Items\n\n- [ ] \n",
    // {{date}} is replaced with YYYY-MM-DD at creation time via string substitution
  },
  // ... other templates
];
```

### API Changes

**Modify: `POST /api/documents`**
- Add optional `templateId` to request body
- If provided, look up template content and return it in response
- Document creation stays the same (just metadata in Prisma)

**New endpoint: `GET /api/templates`**
- Returns list of available templates (id, name, description, icon)
- No auth required (templates are public/static)

### Template Application

On the client side after document creation:
1. Create document via API (get document ID)
2. Navigate to `/doc/[id]`
3. Once Yjs doc syncs and editor is ready, if template content was specified:
   - Parse markdown to ProseMirror nodes via `tiptap-markdown`
   - Insert into empty Yjs doc
   - This triggers sync to all clients and persistence

### UI Changes

**Document List — New Document Flow:**
- Replace single "New Document" button with "New Document" that opens a template picker
- Template picker: grid of cards with icon, name, description
- Click a template → creates doc and navigates to editor with template pre-filled
- "Blank" is always the first option (preserves current behavior)

**Template Picker Design:**
- Modal overlay on document list page
- 2-column grid on desktop, single column on mobile
- Each card: icon (left), name + description (right)
- Click to select, creates immediately (no extra confirmation)

### No Custom Templates in v1

Custom templates would require a new data model, UI for creating/editing templates, and template sharing. This is significant scope for uncertain demand. Ship built-in templates, gauge usage, add custom templates later if needed.

## Team Debate Notes

**PM challenged:** "Should templates be stored in the database for extensibility?"
**SWE 1 response:** "Over-engineering for v1. Code-defined templates ship faster and are easier to maintain. We can migrate to DB-backed templates later without breaking anything."
**Consensus:** Code-defined templates. Revisit when users ask for custom templates.

**SWE 2 challenged:** "Should we support template variables like ${date}?"
**SWE 1 response:** "Only for date — it's the one universally needed variable. Others add complexity without clear value."
**Consensus:** Support `${date}` substitution only, formatted as YYYY-MM-DD.

## Testing Strategy

- Unit test template content validity (each template parses as valid markdown)
- Test document creation with templateId
- Test template application in editor (markdown → ProseMirror → Yjs)
- Manual verification of template picker UX

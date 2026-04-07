# Round 5: Polish & Delight

**Date:** 2026-04-07
**Status:** Approved (internal team consensus)

## Feature 1: Dark Mode

Add a theme toggle (light/dark) in the TopBar. Use CSS custom properties for all colors. Persist preference in localStorage. Default to system preference via `prefers-color-scheme`.

**Implementation:**
- New: `src/lib/theme.ts` — theme context/hook with localStorage persistence
- Modify: `src/app/globals.css` — CSS variables for all colors, `.dark` class overrides
- Modify: `src/app/layout.tsx` — wrap in ThemeProvider, apply class to `<html>`
- Modify: `src/components/TopBar.tsx` — add sun/moon toggle icon

**Color scheme:** Dark sidebar stays dark. Light content area becomes dark gray (#1a1a2e). Text becomes light (#e0e0e0). Accents stay amber/brown.

## Feature 2: Accessibility (ARIA)

Systematic pass adding ARIA attributes to all interactive components.

**Key changes:**
- All toolbar buttons: add `aria-label`, `aria-pressed` for toggles
- Dialogs (Share, Link, Shortcuts, Template Picker): add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Slash command menu: add `role="listbox"`, `role="option"`, `aria-activedescendant`
- Comment sidebar: add `aria-label` on sections
- Search bar: add `role="search"`, `aria-label`
- Notification bell: add `aria-label` with count, `aria-expanded`
- Skip-to-content link at top of page
- Focus trap in modals

## Feature 3: Typing Indicators

Show "X is typing..." when remote users have recent edits. Use Yjs awareness state.

**Implementation:**
- In `src/extensions/remote-cursors.ts` or page.tsx, track when remote users make edits
- Set a typing state in awareness: `provider.awareness.setLocalStateField("typing", true)`
- Clear after 2 seconds of inactivity
- Show typing indicators below the TopBar: "Alice is typing..."
- New: `src/components/TypingIndicator.tsx` — small component showing active typers

## Feature 4: Welcome/Onboarding Modal

First-time users see a welcome modal with 3 steps:
1. "Welcome to MarkdownCollab" — brief intro
2. "Use / commands" — show slash menu screenshot
3. "Collaborate in real-time" — mention sharing, comments

**Implementation:**
- New: `src/components/WelcomeModal.tsx`
- Check `localStorage.getItem('onboarding-complete')` — show modal if not set
- Three steps with Next/Previous/Done buttons
- On "Done", set localStorage flag and close

## Feature 5: Markdown Import

Upload a `.md` file to create a new document with its content.

**Implementation:**
- New button on document list: "Import" (next to "New Document")
- Opens file picker accepting `.md` files
- Creates new document via API
- Reads file content, navigates to editor, injects via tiptap-markdown
- Reuse the same sessionStorage pattern from templates

## Feature 6: Drag & Drop Blocks

Allow dragging blocks (paragraphs, headings, lists) to reorder them.

**Implementation:**
- Check if `@tiptap/extension-drag-handle` exists for Tiptap v3. If yes, install and configure.
- If not, create a simple custom solution: show a drag handle (⠿) on hover to the left of each block, use ProseMirror transactions to move nodes.
- CSS: `.drag-handle` positioned absolutely to the left of blocks.

## Feature 7: Document Tags

Allow tagging documents with custom labels. Tags are per-document, visible in the document list, and filterable.

**Data model:**
```prisma
model Tag {
  id    String @id @default(uuid())
  name  String @unique
  color String @default("#6b7280")
}

model DocumentTag {
  id         String @id @default(uuid())
  documentId String
  tagId      String
  @@unique([documentId, tagId])
}
```

**API:**
- `GET /api/tags` — list all tags
- `POST /api/tags` — create tag
- `POST /api/documents/[id]/tags` — add tag to document
- `DELETE /api/documents/[id]/tags/[tagId]` — remove tag

**UI:**
- Tag chips on document list rows
- Tag filter in sidebar
- Tag management in a popover when clicking "+" on a document row

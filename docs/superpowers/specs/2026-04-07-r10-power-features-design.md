# Round 10: Power Features

**Date:** 2026-04-07
**Status:** Approved

## Feature 1: Presentation Mode

Convert any document into a slide presentation. Headings become slide breaks.

**Implementation:**
- New: `src/components/PresentationMode.tsx` — fullscreen overlay that splits document into slides
- Split logic: each H1 or `---` (horizontal rule) creates a new slide
- Navigation: arrow keys, click edges, escape to exit
- Slide counter: "3 / 12"
- Button in TopBar: "Present" (play icon)
- Minimal styling: centered content, large text, dark background

## Feature 2: Keyboard Shortcut Remapping

Allow users to customize keyboard shortcuts.

**Implementation:**
- New: `src/lib/keybindings.ts` — default bindings + user overrides from localStorage
- Modify KeyboardShortcutsDialog.tsx: add "Customize" button that enables editing mode
- Click a shortcut → press new key combo → save
- Reset to defaults button
- Store in localStorage as JSON: `{ "bold": "Mod-b", "italic": "Mod-i", ... }`

## Feature 3: Document Analytics

Track document views and show basic analytics.

**Implementation:**
- Add `viewCount Int @default(0)` to Document model
- Increment on each document open (API call from page.tsx)
- New: `src/app/api/documents/[id]/analytics/route.ts` — returns view count, edit count (from activity log), collaborator count, creation date, last edit
- Show analytics in a popover from the document list (info icon) or in TopBar

## Feature 4: Webhook Notifications

Allow configuring a webhook URL that receives POST requests on document events.

**Implementation:**
- New Prisma model: `Webhook` (id, url, events: String, ownerId, createdAt)
- Events: "document.edited", "comment.created", "agent.completed"
- New: `src/app/api/webhooks/route.ts` — CRUD
- New: `src/lib/webhook.ts` — `fireWebhook(event, payload)` helper (fire-and-forget POST)
- Settings UI accessible from document list sidebar

## Feature 5: PlantUML Support

Add PlantUML diagram rendering alongside Mermaid.

**Implementation:**
- PlantUML renders via their public server: `https://www.plantuml.com/plantuml/svg/~1{encoded}`
- New: `src/extensions/plantuml-block.ts` — similar to mermaid-block but sends source to PlantUML server
- Uses plantuml-encoder npm package to encode the source
- Add `/plantuml` slash command
- Fallback: show raw source if server unreachable

## Feature 6: Document Pinned Notes

Sticky notes visible to all collaborators — quick annotations that float outside the document.

**Implementation:**
- Store in Yjs Y.Array: `ydoc.getArray("pinnedNotes")`
- Each note: { id, content, author, color, createdAt }
- UI: small colored note cards in a bar above or below the editor
- Add/edit/delete notes
- 4 colors: yellow, blue, pink, green

## Feature 7: Auto-Save to Git

Optionally export documents to a local git repository on every save.

**Implementation:**
- New setting in `.env`: `GIT_EXPORT_PATH` (optional)
- When set, the WebSocket server's save handler also writes markdown to that path
- File: `{GIT_EXPORT_PATH}/{document-title}.md`
- Auto-commit with message: "Update {title}" (using simple-git or child_process)
- Opt-in per-document or global setting

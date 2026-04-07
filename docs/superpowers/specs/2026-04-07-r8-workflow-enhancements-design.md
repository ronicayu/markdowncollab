# Round 8: Workflow Enhancements

**Date:** 2026-04-07
**Status:** Approved

## Feature 1: Text Color Picker

Use `@tiptap/extension-color` and `@tiptap/extension-text-style`. Add a color picker dropdown in the toolbar (A with color bar underneath). Curated palette of 12 colors plus "Default" to remove color.

Install: `npm install @tiptap/extension-color @tiptap/extension-text-style`

Toolbar: Color button with dropdown showing color swatches. Clicking a swatch applies text color. Active color shown as underline on the button.

## Feature 2: Reading/Focus Mode

Toggle that hides toolbar, sidebars, and TopBar controls. Shows only the document content with a minimal floating "Exit" button. Triggered by a button in TopBar or keyboard shortcut.

Implementation: State in page.tsx that toggles CSS classes. When active: hide toolbar, sidebars, shrink TopBar to just title + exit button. Content area expands to full width. Add `Cmd+Shift+F` shortcut.

## Feature 3: Save as Custom Template

Allow users to save the current document's structure as a reusable template.

Implementation:
- Button in TopBar dropdown or document actions: "Save as template"
- Opens dialog: template name, description
- Saves to new Prisma model: `CustomTemplate` (id, name, description, content, ownerId, createdAt)
- Custom templates appear in the template picker alongside built-in ones
- API: GET/POST /api/templates/custom

## Feature 4: Comment Reactions (Emoji)

Add emoji reactions to comments (thumbs-up, heart, eyes, fire, party, thinking).

Implementation:
- Small reaction bar below each comment in CommentCard.tsx
- Click to toggle a reaction
- Reactions stored in the Yjs comments map (reactions field: Record<emoji, string[]> mapping emoji to user IDs)
- Show reaction counts with who reacted on hover

## Feature 5: Date/Time Insertion

Slash command `/date` that inserts today's date, `/time` for current time, `/datetime` for both.

Implementation: Add 3 commands to SlashCommandMenu.tsx. Each inserts formatted text:
- `/date` → "2026-04-07"
- `/time` → "2:30 PM"
- `/datetime` → "2026-04-07 2:30 PM"

## Feature 6: Superscript & Subscript

Use `@tiptap/extension-superscript` and `@tiptap/extension-subscript`.

Install both. Add toolbar buttons (x² and x₂). Keyboard shortcuts: Cmd+. for superscript, Cmd+, for subscript.

## Feature 7: URL Embeds (YouTube/Loom)

When a YouTube or Loom URL is pasted on its own line, auto-convert to an embedded iframe.

Implementation: Custom Tiptap extension that detects YouTube/Loom URL patterns in pasted content. Replaces the URL with an iframe node. Renders as a responsive 16:9 iframe in the editor.

Patterns:
- YouTube: `youtube.com/watch?v=` or `youtu.be/`
- Loom: `loom.com/share/`

# Round 17: Refinement

**Date:** 2026-04-08

## Feature 1: Document Templates Gallery
Browse templates with markdown previews before selecting.
- Modify TemplatePicker: add preview panel on hover/click
- Show rendered markdown preview of each template
- Tabs: "Built-in" and "Your Templates"
- Search/filter templates

## Feature 2: Inline Comment Highlights
Improve comment visibility by showing comment indicators inline in the document.
- When hovering over commented text, show a small popover with the comment
- Highlight commented text ranges more prominently (currently subtle)
- Click highlighted text to jump to that comment in the sidebar
- Show comment count badge on highlighted ranges with multiple comments

## Feature 3: Document Forking
Create a copy of a document that maintains a link back to the original.
- "Fork" button on document list and in TopBar
- Creates a new doc with content copied, `forkedFrom: documentId` field
- Shows "Forked from: [Original]" badge in TopBar
- Can compare fork with original (reuse diff viewer)

## Feature 4: Quick Note / Scratchpad
Persistent scratchpad accessible from anywhere via keyboard shortcut.
- Cmd+Shift+N opens a small floating textarea
- Content saved to localStorage
- Paste from scratchpad into any document
- Persists across page navigation

## Feature 5: Paste as Plain Text
Cmd+Shift+V to paste without formatting.
- Add paste handler in Editor.tsx that strips HTML on Shift+V
- Uses `event.clipboardData.getData('text/plain')` instead of HTML

## Feature 6: Keyboard Navigation for Doc List
Arrow keys to navigate document list, Enter to open.
- Up/Down arrows move focus between document rows
- Enter opens the focused document
- Escape clears focus
- Visual focus indicator (outline/highlight on focused row)

## Feature 7: Enhanced Save Status
Show who last saved and detect conflicts.
- "Saved by Alice 2m ago" instead of just "Saved 2m ago"
- Track last editor via Yjs awareness
- If document was edited while you were away, show "Updated while you were away" banner

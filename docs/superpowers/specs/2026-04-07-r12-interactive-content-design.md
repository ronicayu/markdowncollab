# Round 12: Interactive Content

**Date:** 2026-04-07
**Status:** Approved

## Feature 1: Inline Polls/Voting
Custom block where collaborators can vote on options. Stored in Yjs for real-time sync.
- Slash command: `/poll`
- Creates poll with question + 2-4 options
- Each user votes once (tracked by name in Yjs Y.Map)
- Shows live vote counts and percentages
- Results bar chart visualization

## Feature 2: Document Comparison
Compare two different documents side-by-side with diff highlighting.
- Button on document list: select two docs → "Compare"
- New page/modal: `/compare?a={id1}&b={id2}`
- Uses `diff` package (already installed from R9)
- Side-by-side markdown with red/green highlighting

## Feature 3: Reading Progress Bar
Thin progress bar at top of editor showing scroll position.
- Fixed bar below toolbar
- Width = scrollPercentage% of viewport
- Amber colored, 3px height
- Only visible when document is longer than viewport

## Feature 4: Heading Auto-Numbering
Optional auto-numbering of headings: 1., 1.1., 1.2., 2., 2.1.
- CSS counters approach (no extension needed)
- Toggle in toolbar or document settings
- Stored as document preference in localStorage
- Only applies to H2-H4 (H1 is the title)

## Feature 5: Toggle Lists
Collapsible bullet points — click to expand/collapse content under each item.
- New Tiptap extension: `toggleList` / `toggleItem`
- Each item has a clickable triangle indicator
- Content below the first line collapses
- Slash command: `/toggle`
- Great for FAQs, meeting agendas

## Feature 6: Inline Status Badges
Inline colored badges for status tracking.
- Slash command: `/badge` or `/status`
- Predefined badges: To Do (gray), In Progress (blue), Done (green), Blocked (red), Needs Review (amber)
- Renders as small colored pill with text
- Custom Tiptap inline node

## Feature 7: Smart Paste
Detect pasted content format and convert appropriately.
- Tab-separated text → table
- Code with common patterns → code block with detected language
- URL on its own line → embed (already have this for YouTube/Loom, extend to generic unfurl)
- Markdown → proper formatting (already have tiptap-markdown)

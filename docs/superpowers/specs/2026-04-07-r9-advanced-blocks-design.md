# Round 9: Advanced Content Blocks

**Date:** 2026-04-07
**Status:** Approved

## Feature 1: Math/LaTeX Blocks (KaTeX)

Render math equations using KaTeX. Support both inline math (`$E=mc^2$`) and display math blocks (`$$`).

Install: `npm install katex @tiptap/extension-mathematics` or build custom.
Simpler: Install `katex` and create a custom node extension that renders KaTeX.

**Implementation:**
- New: `src/extensions/math-block.ts` — custom node for display math ($$...$$)
- Inline math: extend the editor to parse `$...$` as inline math marks
- Render using `katex.renderToString()`
- Add `/math` slash command
- CSS: import KaTeX stylesheet
- Export: `$$formula$$` in markdown

## Feature 2: Collapsible/Details Blocks

HTML `<details><summary>` equivalent for collapsible content sections.

**Implementation:**
- New: `src/extensions/details-block.ts` — custom node with summary + content
- Click summary to expand/collapse
- Slash command: `/details` or `/collapse`
- Renders as styled collapsible section with chevron indicator
- Export: `<details><summary>Title</summary>Content</details>` in markdown

## Feature 3: Reading Time Estimate

Show estimated reading time next to word count in the editor footer.

**Implementation:**
- Modify Editor.tsx footer to show "X min read" based on word count / 200 WPM
- Simple calculation, no new extension needed

## Feature 4: Document Activity Log

Track and display recent document activity (edits, comments, shares).

**Implementation:**
- New Prisma model: `ActivityLog` (id, documentId, userId, userName, action, detail, createdAt)
- Log actions: "edited", "commented", "shared", "restored version", "invited agent"
- New: `src/app/api/documents/[id]/activity/route.ts` — GET paginated activity
- UI: Activity tab in version history panel or separate panel
- Show: "Alice edited 5m ago", "Bob commented 2h ago"

## Feature 5: Two-Column Layout Block

Side-by-side content areas for comparisons, before/after, or layout variety.

**Implementation:**
- New: `src/extensions/columns-block.ts` — custom node with two child content areas
- Renders as CSS grid (2 columns, 50/50 split)
- Each column is editable independently
- Slash command: `/columns`
- Export: columns as sequential content in markdown (no markdown equivalent)

## Feature 6: Version Diff View

Compare two document versions side-by-side with highlighted changes.

**Implementation:**
- Install `diff` npm package for text diffing
- Modify VersionHistoryPanel.tsx: add "Compare" button on each version
- When comparing: fetch markdown of both versions, run diff, show side-by-side with red/green highlights
- New component: `src/components/DiffViewer.tsx`

## Feature 7: Slash Command Favorites

Track which slash commands users use most frequently and show them at the top.

**Implementation:**
- Store command usage counts in localStorage
- Sort slash command menu: favorites first (top 3 most used), then all commands
- Show a subtle divider between favorites and all commands
- Reset option in settings

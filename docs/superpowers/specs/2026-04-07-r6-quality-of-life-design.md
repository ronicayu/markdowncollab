# Round 6: Quality of Life

**Date:** 2026-04-07
**Status:** Approved (internal team consensus)

## Feature 1: Interactive Task Lists

Use `@tiptap/extension-task-list` and `@tiptap/extension-task-item`. Checkboxes that toggle on click. Exports as `- [ ]` / `- [x]` in markdown.

Install: `npm install @tiptap/extension-task-list @tiptap/extension-task-item`
Add to Editor.tsx extensions. Add `/todo` slash command. Add task list button to Toolbar.
Style checkboxes to match the warm amber theme.

## Feature 2: Quick Command Palette (Cmd+P)

Global document switcher. Press Cmd+P from anywhere in the app to search and jump to documents.

Create: `src/components/CommandPalette.tsx`
- Modal overlay with search input
- Fetches documents from `/api/documents` on open
- Fuzzy filter as user types
- Keyboard navigation (up/down arrows, Enter to select)
- Shows document title, last updated time
- Navigates to selected document on Enter
- Recently opened docs at top

Wire up: Global keydown listener for Cmd+P in layout.tsx or page.tsx.

## Feature 3: GitHub Actions CI

Create: `.github/workflows/test.yml`
- Trigger: push + pull_request
- Node.js 22, npm ci
- Run: `npx vitest run` (unit tests)
- Skip Playwright for now (requires browser install in CI)

## Feature 4: Print Styling

Add `@media print` rules to globals.css:
- Hide sidebar, toolbar, TopBar, comment sidebar, floating buttons
- White background, black text
- Show only editor content area
- Page break rules for headings
- Proper margins

## Feature 5: Comprehensive README

Expand README.md with:
- Project description (1 paragraph)
- Screenshot
- Feature list (categorized)
- Quick start (clone, install, env setup, run)
- Tech stack
- Architecture overview (Yjs sync, Tiptap, Next.js)
- Testing commands
- Contributing guidelines

## Feature 6: Callout/Admonition Blocks

Custom Tiptap extension for styled callout blocks: info (blue), warning (yellow), tip (green), danger (red).

Create: `src/extensions/callout-block.ts` — custom node with `type` attribute
Add `/callout`, `/info`, `/warning`, `/tip` slash commands.
Style with colored left border and background tint.
Export as markdown blockquote with prefix: `> **Info:** content`

## Feature 7: Update Keyboard Shortcuts Dialog

Read KeyboardShortcutsDialog.tsx, update to include ALL current shortcuts:
- Cmd+K (link), Cmd+U (underline), Cmd+Shift+H (highlight)
- Cmd+Shift+L/E/R (alignment)
- Cmd+P (command palette)
- All formatting shortcuts
- Tab/Shift+Tab (indent/outdent in lists)

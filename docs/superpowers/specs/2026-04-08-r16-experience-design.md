# Round 16: Experience Layer

**Date:** 2026-04-08

## Feature 1: Floating Bubble Toolbar
Medium-style floating toolbar that appears on text selection.
- Shows: Bold, Italic, Underline, Link, Highlight, Comment
- Positioned above the selection
- Disappears on deselection
- Tiptap has `@tiptap/extension-bubble-menu` — use it
- Complement the static toolbar, not replace it

## Feature 2: Document Cover Images
Visual header image at the top of each document.
- Click "Add cover" banner at top of editor (before content)
- Opens image upload dialog (reuse existing upload infrastructure)
- Stores cover image URL on Document model: `coverImage String?`
- Renders as a full-width banner above the title
- Remove cover option on hover

## Feature 3: Split View
View two documents side-by-side in the browser.
- New route: `/split?left={id1}&right={id2}`
- Two independent editor instances sharing the viewport 50/50
- Each has its own toolbar, sidebar toggle, Yjs connection
- Useful for: comparing drafts, referencing one doc while writing another

## Feature 4: AI Auto-Complete
As-you-type writing suggestions (ghost text, like GitHub Copilot).
- When user pauses typing for 2s, send last paragraph to Anthropic
- Show suggestion as gray ghost text after cursor
- Tab to accept, Escape or keep typing to dismiss
- Rate limited: max 10 completions per minute
- Toggle on/off in TopBar

## Feature 5: Focus Timer (Pomodoro)
Built-in writing timer for focused sessions.
- Small timer widget in the footer (next to word count)
- Click to start a 25-minute session
- Shows countdown, gentle notification on complete
- Track sessions in localStorage: `pomodoroSessions:{docId}`
- Optional: show "focus streak" badge

## Feature 6: Document Merge
Combine two documents into one.
- Select two docs on list page → "Merge" button
- Choose: append doc B after doc A, or interleave sections
- Creates a new document with combined content
- Original docs preserved (not deleted)

## Feature 7: Custom Fonts
Per-document font selection for the editor.
- Font selector in TopBar or document settings
- Options: Default (Georgia), Sans-serif (Inter), Monospace (JetBrains Mono), Serif (Merriweather)
- Store preference on Document model: `fontFamily String?`
- Apply as CSS variable on editor container

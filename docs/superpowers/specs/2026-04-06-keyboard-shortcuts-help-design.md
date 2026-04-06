# Keyboard Shortcuts Help

**Date:** 2026-04-06
**Status:** Approved (internal team consensus)
**Priority:** P2 — Discoverability for power users

## Problem

The editor has many keyboard shortcuts (bold, italic, headings, lists, code, etc.) inherited from Tiptap's StarterKit, plus custom ones (slash commands, find/replace). Users have no way to discover them other than guessing.

## Design

### Approach

A keyboard shortcuts help dialog triggered by `Cmd+/` or a `?` button in the toolbar. Simple modal with categorized shortcut list. No configuration — just reference.

### Shortcut Categories

**Text Formatting:**
| Shortcut | Action |
|----------|--------|
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+U | Underline |
| Cmd+E | Inline code |
| Cmd+Shift+X | Strikethrough |

**Blocks:**
| Shortcut | Action |
|----------|--------|
| Cmd+Alt+1-6 | Heading 1-6 |
| Cmd+Shift+7 | Ordered list |
| Cmd+Shift+8 | Bullet list |
| Cmd+Shift+9 | Blockquote |
| Cmd+Alt+C | Code block |
| / | Slash command menu |

**Editing:**
| Shortcut | Action |
|----------|--------|
| Cmd+F | Find |
| Cmd+H | Find & Replace |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |
| Tab | Indent list |
| Shift+Tab | Outdent list |

**Navigation:**
| Shortcut | Action |
|----------|--------|
| Cmd+/ | Show this help |
| Escape | Close dialog / search |

### Implementation

**New component: `src/components/KeyboardShortcutsDialog.tsx`**
- Modal overlay with backdrop
- Categorized table layout
- Platform-aware: show `Cmd` on Mac, `Ctrl` on Windows/Linux
- Close on Escape or backdrop click

**Integration:**
- Register `Cmd+/` shortcut in Editor.tsx via Tiptap `addKeyboardShortcuts()`
- Add `?` icon button to right side of Toolbar
- Both trigger the same dialog

### Shortcut Key Display

Render shortcut keys as styled `<kbd>` elements matching the editor's design system. Light background, rounded corners, subtle border — standard keyboard key appearance.

### Platform Detection

```typescript
const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const modKey = isMac ? '⌘' : 'Ctrl';
```

## Team Debate Notes

**SWE 2 challenged:** "Do we need a full dialog? Could just be a tooltip."
**PM response:** "There are 20+ shortcuts. A tooltip can't hold that. Dialog is the right pattern — VS Code, Notion, Google Docs all use it."
**Consensus:** Modal dialog.

**SWE 1 challenged:** "Should shortcuts be configurable?"
**PM response:** "No. Custom keybindings are massive scope for near-zero demand. Reference-only."
**Consensus:** Read-only reference. No customization.

## Testing Strategy

- Test dialog opens/closes on Cmd+/ and ? button click
- Test platform detection (Mac vs Windows display)
- Verify all listed shortcuts actually work in the editor
- Test Escape closes dialog

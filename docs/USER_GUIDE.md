# MarkdownCollab User Guide

Welcome to MarkdownCollab, a real-time collaborative markdown editor for teams. This guide covers everything you need to know to get the most out of the app.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Documents](#creating-documents)
3. [The Editor](#the-editor)
4. [Formatting Text](#formatting-text)
5. [Slash Commands](#slash-commands)
6. [Footnotes](#footnotes)
7. [Word Count Goals](#word-count-goals)
8. [Tables](#tables)
7. [Images](#images)
8. [Code Blocks](#code-blocks)
9. [Mermaid Diagrams](#mermaid-diagrams)
10. [Callout Blocks](#callout-blocks)
11. [Task Lists](#task-lists)
12. [Links](#links)
13. [Find & Replace](#find--replace)
14. [Real-Time Collaboration](#real-time-collaboration)
15. [Comments & Mentions](#comments--mentions)
16. [AI Writing Assistant](#ai-writing-assistant)
17. [Sharing & Permissions](#sharing--permissions)
18. [Version History](#version-history)
19. [Document Management](#document-management)
20. [Notifications](#notifications)
21. [Exporting Documents](#exporting-documents)
22. [Importing Documents](#importing-documents)
23. [Command Palette](#command-palette)
24. [Dark Mode](#dark-mode)
25. [Printing](#printing)
26. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Getting Started

When you first open MarkdownCollab, you'll see a welcome tour introducing the key features. You can skip it or walk through the three steps:

1. **Welcome** — Overview of what MarkdownCollab does
2. **Slash Commands** — How to use `/` to quickly insert content
3. **Collaboration** — How sharing, comments, and AI assistance work

The tour only appears once. After dismissing it, you'll land on the document list.

### Signing In

Click **Sign in** at the bottom of the sidebar. You can sign in with:
- **Email & Password** — Register a new account or sign in with existing credentials
- **Google OAuth** — Sign in with your Google account (if configured by your admin)

Signing in unlocks: document ownership, sharing, notifications, and starred documents. You can use the editor without signing in, but documents will be accessible to everyone.

---

## Creating Documents

From the document list, click **+ New Document** to open the template picker.

### Templates

Choose from 7 built-in templates:

| Template | Best For |
|----------|----------|
| **Blank** | Starting from scratch |
| **Meeting Notes** | Agendas, discussions, action items |
| **ADR** | Architecture Decision Records |
| **RFC** | Request for Comments proposals |
| **Standup Update** | Daily standup summaries |
| **Project Brief** | Project scope, timeline, stakeholders |
| **Bug Report** | Steps to reproduce, expected vs actual behavior |

Templates automatically fill in today's date. Click any template card to create the document and jump straight into editing.

---

## The Editor

The editor has three main areas:

### Top Bar
- **Document title** — Click to rename
- **Connection status** — Green dot = connected to collaboration server
- **Collaborator avatars** — Shows who else is viewing/editing
- **Export** — Download as Markdown or PDF
- **History** — Browse and restore previous versions
- **Invite Agent** — Ask the AI assistant to review your document
- **Share** — Share with teammates via email or link
- **Theme toggle** — Switch between light, dark, and system theme

### Toolbar
The formatting toolbar sits below the top bar with buttons for all text formatting, block types, alignment, lists, and editing tools. Hover over any button to see its name and keyboard shortcut.

### Sidebars
- **Outline** (left) — Shows all headings in your document. Click any heading to jump to it. Toggle with the collapse button.
- **Comments** (right) — Shows all comments and AI suggestions. Toggle with the speech bubble icon.

### Status Bar
At the bottom: save status ("Saved just now" or "Saving...") and word/character count.

---

## Formatting Text

### Basic Formatting

| Format | Shortcut | Toolbar |
|--------|----------|---------|
| **Bold** | Cmd+B | **B** button |
| *Italic* | Cmd+I | *I* button |
| Underline | Cmd+U | **U** button |
| ~~Strikethrough~~ | Cmd+Shift+X | **S** button |
| Highlight | Cmd+Shift+H | Marker icon |
| `Inline code` | Cmd+E | `<>` button |

### Text Alignment

| Alignment | Shortcut | Toolbar |
|-----------|----------|---------|
| Left | Cmd+Shift+L | Left-align icon |
| Center | Cmd+Shift+E | Center-align icon |
| Right | Cmd+Shift+R | Right-align icon |

### Headings

| Heading | Shortcut | Toolbar |
|---------|----------|---------|
| Heading 1 | Cmd+Alt+1 | **H1** button |
| Heading 2 | Cmd+Alt+2 | **H2** button |
| Heading 3 | Cmd+Alt+3 | **H3** button |
| Heading 4-6 | Cmd+Alt+4-6 | Via slash command |

### Lists

| List Type | Shortcut | Toolbar |
|-----------|----------|---------|
| Bullet list | Cmd+Shift+8 | Bullet icon |
| Numbered list | Cmd+Shift+7 | Number icon |
| Task list | — | Checkbox icon or `/todo` |
| Indent item | Tab | Right-arrow icon |
| Outdent item | Shift+Tab | Left-arrow icon |

### Blockquote

Press Cmd+Shift+B or click the quote icon in the toolbar. You can also type `/blockquote` in the slash menu.

### Horizontal Rule

Click the horizontal line icon in the toolbar, or type `/divider`.

---

## Slash Commands

Type `/` anywhere in the editor to open the command menu. Start typing to filter commands.

| Command | What it does |
|---------|-------------|
| `/heading1` `/heading2` `/heading3` | Insert heading |
| `/bullet` | Start a bullet list |
| `/ordered` | Start a numbered list |
| `/todo` | Start a task list with checkboxes |
| `/blockquote` | Insert a blockquote |
| `/code` | Insert a code block |
| `/mermaid` | Insert a Mermaid diagram block |
| `/link` | Open the link dialog |
| `/divider` | Insert a horizontal rule |
| `/image` | Upload and insert an image |
| `/table` | Insert a 3x3 table |
| `/callout` | Insert an info callout |
| `/warning` | Insert a warning callout |
| `/tip` | Insert a tip callout |
| `/danger` | Insert a danger callout |
| `/footnote` | Insert a footnote reference |

---

## Footnotes

Use the `/footnote` slash command to insert academic-style footnotes.

**How it works:**
1. Place your cursor where you want the footnote reference
2. Type `/footnote` and select it from the menu
3. A superscript number (e.g., ^1) is inserted at the cursor
4. A numbered footnote entry is added at the bottom of the document
5. Replace `[footnote text]` with your actual footnote content

Footnotes auto-increment: the first is ^1, the second ^2, and so on. A horizontal rule separates the document body from the footnotes section.

---

## Word Count Goals

Click the word count in the editor footer to set a writing goal.

**Setting a goal:**
1. Click the word/character count at the bottom-right of the editor
2. Enter your target word count (e.g., 500)
3. Click **Set** or press Enter

**Progress display:**
- Shows "150 / 500 words" with a progress bar
- **Gray** when under 50% of goal
- **Amber** when approaching (50-99%)
- **Green** when goal is reached (100%)

Click the count again to update or remove the goal. Goals are saved per document and persist across sessions.

---

## Tables

Insert a table using the table icon in the toolbar or the `/table` slash command. This creates a 3x3 table with a header row.

**Editing tables:**
- Click any cell to start typing
- Use Tab to move to the next cell
- Use Shift+Tab to move to the previous cell
- The header row (first row) is styled differently

**Tips:**
- Tables work in real-time collaboration — multiple people can edit different cells simultaneously
- Tables export as pipe-delimited markdown

---

## Images

Insert images using the `/image` slash command (opens a file picker) or by **pasting** an image from your clipboard directly into the editor.

**Supported formats:** PNG, JPG, GIF, WebP

**How it works:**
1. Select or paste an image
2. The image uploads to the server
3. It appears inline in your document
4. Click an image to select it (shows a blue outline)

Images are stored per-document and cleaned up when a document is permanently deleted.

---

## Code Blocks

Insert a code block with the toolbar button, Cmd+Alt+C, or `/code`.

**Language selection:** When your cursor is inside a code block, a language dropdown appears at the top of the block. Select from 19 languages:

JavaScript, TypeScript, Python, Go, Rust, Java, C, C++, Ruby, PHP, SQL, HTML, CSS, JSON, YAML, Bash, Markdown, Mermaid, Plain Text

---

## Mermaid Diagrams

Insert a Mermaid diagram with the toolbar button or `/mermaid`. Write Mermaid syntax and the diagram renders live.

Example:
```
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Do thing]
    B -->|No| D[Skip]
```

If there's a syntax error, the block shows an error message. Fix the syntax and it re-renders automatically.

---

## Callout Blocks

Callout blocks are colored containers for highlighting important information. Insert them via slash commands:

| Command | Type | Color | Use for |
|---------|------|-------|---------|
| `/callout` | Info | Blue | General information, notes |
| `/warning` | Warning | Amber | Cautions, things to watch out for |
| `/tip` | Tip | Green | Helpful suggestions, best practices |
| `/danger` | Danger | Red | Critical warnings, breaking changes |

Press Enter at the end of a callout to exit it and continue writing below.

---

## Task Lists

Create interactive checklists with the `/todo` slash command or the checkbox toolbar button.

- Click a checkbox to toggle it
- Completed items get a strikethrough style
- Task lists export as `- [ ]` (unchecked) and `- [x]` (checked) in markdown
- Use Tab/Shift+Tab to nest task items

Great for meeting action items, sprint tasks, and checklists.

---

## Links

Insert a link with Cmd+K or the chain icon in the toolbar.

**Link dialog:**
1. Press Cmd+K (or click the link button)
2. Enter the URL
3. Optionally change the display text (defaults to your selected text)
4. Click **Apply**

**Auto-linking:** When you paste a URL into the editor, it automatically becomes a clickable link.

To **remove a link**, place your cursor in the linked text and press Cmd+K, then click **Remove Link**.

---

## Find & Replace

Press Cmd+F to open the search bar, or click the magnifying glass in the toolbar.

**Features:**
- **Search** — Type your query. Matches are highlighted in yellow, the current match in orange.
- **Match count** — Shows "1 of 3" style counter
- **Navigate** — Use the up/down arrows or Enter/Shift+Enter to jump between matches
- **Case sensitivity** — Toggle with the "Aa" button
- **Replace** — Click "Show replace" to expand. Replace one at a time or all at once.

Press Escape or the X button to close search.

---

## Real-Time Collaboration

### Live Cursors

When multiple people edit the same document, you'll see their cursors as colored carets with name labels. Each collaborator gets a unique color based on their name.

### Typing Indicators

When someone is actively typing, you'll see "Alice is typing..." or "Alice and Bob are typing..." below the toolbar.

### Collaborator Avatars

The top bar shows avatar circles for everyone currently viewing the document. Each avatar shows the user's initials and assigned color.

### How Sync Works

MarkdownCollab uses CRDT (Conflict-free Replicated Data Type) technology. This means:
- Edits merge automatically without conflicts
- No "someone else is editing" lock-outs
- Works even with poor network connections
- Changes sync instantly when reconnected

---

## Comments & Mentions

### Adding a Comment

1. Select text in the editor
2. A floating "+" button appears
3. Click it to open the comment form
4. Type your comment and submit

### Viewing Comments

Click the speech bubble icon on the right edge to open the comment sidebar. Comments are anchored to the text they reference. Click a comment to highlight the relevant text.

### Filtering Comments

The comment sidebar has tabs: **Open**, **Resolved**, and **All**.

### Replying

Click on any comment to expand it and type a reply. Threaded replies keep discussions organized.

### Resolving Comments

Click the resolve button on a comment to mark it as addressed. Resolved comments move to the "Resolved" tab.

### @Mentions

Type `@` in the comment input to mention a collaborator. An autocomplete dropdown shows users who have access to the document. Mentioned users receive a notification.

---

## AI Writing Assistant

Click **Invite Agent** in the top bar to have Claude review your document.

### How It Works

1. Click "Invite Agent"
2. The AI reads your document
3. It generates suggestions based on your document type
4. Suggestions appear in the comment sidebar

### Context-Aware Reviews

The AI tailors its feedback to your document template:

| Template | Focus Areas |
|----------|------------|
| Meeting Notes | Action items specificity, decision clarity |
| ADR | Decision clarity, context sufficiency, trade-off honesty |
| RFC | Motivation strength, design detail, alternatives fairness |
| Standup | Blocker clarity, item specificity |
| Project Brief | Scope boundaries, timeline realism, risk identification |
| Bug Report | Repro steps specificity, expected vs actual clarity |
| Generic | Grammar, clarity, style, conciseness |

### Accepting or Rejecting Suggestions

Each suggestion in the sidebar shows:
- The original text
- The suggested replacement
- A rationale explaining why

Click **Accept** to apply the change or **Reject** to dismiss it.

---

## Sharing & Permissions

Click the **Share** button in the top bar to share your document.

### Roles

| Role | View | Edit | Comment | Share | Delete |
|------|------|------|---------|-------|--------|
| Viewer | Yes | No | Yes | No | No |
| Editor | Yes | Yes | Yes | No | No |
| Owner | Yes | Yes | Yes | Yes | Yes |

### Sharing by Email

1. Open the Share dialog
2. Enter a collaborator's email
3. Choose their role (Viewer or Editor)
4. Click Share

### Link Sharing

Toggle "Anyone with the link" to generate a shareable URL. Choose whether link recipients get Viewer or Editor access.

### View-Only Mode

When you access a document as a Viewer, the toolbar is hidden and the editor is read-only. You can still leave comments.

---

## Version History

Click the **History** button (clock icon) in the top bar to open the version history panel.

### Auto-Snapshots

The system automatically saves snapshots:
- Every 30 minutes of active editing
- When the last collaborator disconnects
- Up to 50 auto-snapshots are kept per document

### Manual Snapshots

Click **Save version** at the top of the history panel to create a named snapshot at any time.

### Previewing Versions

Click any version in the list to preview it as rendered markdown.

### Restoring Versions

Click **Restore** on any version to revert the document. A safety snapshot ("Before restore") is automatically created first, so you can always undo a restore.

---

## Document Management

### Document List

The home page shows all your documents. Each row displays:
- Document title
- Last updated time
- Star button
- Tag chips
- Manage tags button
- Duplicate and delete buttons

### Sidebar Tabs

| Tab | Shows |
|-----|-------|
| **All Documents** | Every document you own or have access to |
| **Recent** | Documents updated in the last 7 days |
| **Shared with me** | Documents others have shared with you |
| **Starred** | Your favorited documents |
| **Trash** | Soft-deleted documents |

### Searching

The search bar searches both document **titles** and **content**. Results show highlighted snippets of matching text. Search is debounced — it triggers 300ms after you stop typing.

### Sorting

Click the sort button to toggle between:
- **Date** (newest first) — default
- **Name** (alphabetical)

Starred documents always float to the top regardless of sort order.

### Starring Documents

Click the star icon on any document to pin it. Starred documents appear at the top of the list. Stars are per-user — your stars don't affect other users.

### Tags

Click the tag icon on a document to manage its tags:
- Toggle existing tags on/off
- Create new tags with custom names
- Filter documents by tag in the sidebar

### Trash & Restore

When you delete a document, it moves to Trash (soft delete). From the Trash tab:
- **Restore** — Moves the document back to your list
- **Delete permanently** — Removes the document and all associated data forever

Documents in trash are automatically purged after 30 days.

### Bulk Operations

Use the checkboxes to select multiple documents for bulk deletion.

---

## Notifications

The bell icon in the top bar shows your unread notification count.

### Notification Types

| Event | Who Gets Notified |
|-------|-------------------|
| New comment | Document owner and editors |
| Comment reply | Original comment author |
| @Mention | Mentioned user |
| Document shared | Share recipient |
| Suggestion added | Document owner and editors |
| Suggestion accepted/rejected | Suggestion author |

Click a notification to navigate to the relevant document. Click **Mark all as read** to clear the badge.

---

## Exporting Documents

Click the **Export** dropdown in the top bar:

### Markdown (.md)
Downloads a clean markdown file. Handles all formatting: headings, lists, tables, code blocks, images, links, and callouts. Suggestion marks are filtered out.

### PDF (.pdf)
Downloads a styled PDF rendered server-side. Includes:
- Clean typography (Georgia font)
- Proper table formatting
- Code block styling
- Image embedding
- A4 page format with margins

---

## Importing Documents

From the document list, click **Import** (next to New Document) to upload a `.md` file.

1. Click Import
2. Select a `.md` file from your computer
3. A new document is created with the file's content
4. You're taken directly to the editor

The filename (minus `.md`) becomes the document title.

---

## Command Palette

Press **Cmd+P** (Mac) or **Ctrl+P** (Windows/Linux) from anywhere in the app to open the command palette.

The palette is a quick document switcher:
- Search by document title
- Navigate with arrow keys
- Press Enter to open
- Press Escape to close

Works from both the document list and the editor, so you can switch between documents without going back to the home page.

---

## Dark Mode

Click the theme toggle in the top bar to switch between:
- **Light** (sun icon) — Warm beige background
- **Dark** (moon icon) — Dark gray background with light text
- **System** (monitor icon) — Follows your OS preference

Your theme choice is saved and persists across sessions.

---

## Printing

Use your browser's print function (Cmd+P on Mac, Ctrl+P on Windows) to print a document.

The print layout automatically:
- Hides the toolbar, sidebars, top bar, and all UI chrome
- Shows only the document content
- Uses a white background with black text
- Adds proper margins
- Inserts page breaks before major headings
- Displays link URLs inline

For higher quality output, use the PDF export instead.

---

## Keyboard Shortcuts

Press **Cmd+/** to open the keyboard shortcuts reference at any time.

### Text Formatting
| Shortcut | Action |
|----------|--------|
| Cmd+B | Bold |
| Cmd+I | Italic |
| Cmd+U | Underline |
| Cmd+E | Inline code |
| Cmd+Shift+X | Strikethrough |
| Cmd+Shift+H | Highlight |
| Cmd+K | Insert link |

### Blocks
| Shortcut | Action |
|----------|--------|
| Cmd+Alt+1 through 6 | Heading 1-6 |
| Cmd+Shift+7 | Ordered list |
| Cmd+Shift+8 | Bullet list |
| Cmd+Shift+B | Blockquote |
| Cmd+Alt+C | Code block |
| / | Slash command menu |

### Alignment
| Shortcut | Action |
|----------|--------|
| Cmd+Shift+L | Align left |
| Cmd+Shift+E | Align center |
| Cmd+Shift+R | Align right |

### Lists
| Shortcut | Action |
|----------|--------|
| Tab | Indent list item |
| Shift+Tab | Outdent list item |

### Editing
| Shortcut | Action |
|----------|--------|
| Cmd+F | Find |
| Cmd+H | Find & Replace |
| Cmd+Z | Undo |
| Cmd+Shift+Z | Redo |

### Navigation
| Shortcut | Action |
|----------|--------|
| Cmd+P | Command palette (document switcher) |
| Cmd+/ | Keyboard shortcuts reference |
| Escape | Close dialog or search |

*On Windows/Linux, replace Cmd with Ctrl.*

---

## Tips & Tricks

- **Quick formatting:** Select text and use keyboard shortcuts. No need to click toolbar buttons.
- **Drag blocks:** Hover over the left edge of any block to see the drag handle. Drag to reorder paragraphs, headings, and lists.
- **Paste images:** Copy an image and paste it directly into the editor. It uploads automatically.
- **Auto-links:** Paste a URL and it becomes a clickable link automatically.
- **Template variables:** Templates automatically insert today's date where `{{date}}` appears.
- **Outline navigation:** Use the left sidebar outline to jump between sections in long documents.
- **Quick document switch:** Cmd+P lets you jump to any document without leaving the editor.
- **Undo is collaborative:** Undo only reverts your own changes, not your collaborators' edits.

---

*MarkdownCollab — Write together, ship faster.*

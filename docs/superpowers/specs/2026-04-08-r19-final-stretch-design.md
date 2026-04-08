# Round 19

## Feature 1: Template Marketplace
Publish custom templates so other users can browse and use them.
- Add `published Boolean @default(false)` to CustomTemplate model
- New API: GET /api/templates/marketplace — returns all published templates from all users
- Add "Publish" toggle on custom template management
- Show "Community Templates" tab in TemplatePicker

## Feature 2: AI Grammar Check (Simplified)
Underline grammar issues detected by the AI.
- New API: POST /api/agent/grammar — sends text, returns array of {start, end, message, suggestion}
- ProseMirror decorations for squiggly red underlines on detected issues
- Tooltip on hover showing the issue and suggested fix
- Triggered on typing pause (5s debounce), scoped to changed paragraph only
- Toggle on/off in TopBar

## Feature 3: Progress Bar Block
Visual progress indicator in documents (e.g., project progress, task completion).
- New extension: `src/extensions/progress-block.ts`
- Attributes: label, value (0-100), color
- Renders as a labeled progress bar
- Click to edit value
- Slash command: `/progress`

## Feature 4: Tab Groups
Open multiple documents in tabs at the top of the editor.
- Track open tabs in localStorage
- Tab bar below TopBar showing open doc tabs
- Click tab to switch (load that doc's Yjs connection)
- Close tab (X button)
- Cmd+W closes current tab
- Actually: simpler approach — tabs are just links. Each tab navigates to /doc/{id}. The tab bar persists via localStorage.

## Feature 5: Document Changelog
Auto-generate a changelog from version history and activity log.
- New API: GET /api/documents/[id]/changelog
- Aggregates: version snapshots + activity log entries
- Groups by date
- Returns formatted markdown changelog
- Show in version history panel as new tab

## Feature 6: Rich Notification Content
Enhance notifications with context previews.
- When showing notification dropdown, include a snippet of the comment/mention text
- Show the first 100 chars of the referenced content
- Requires updating notification model or fetching context at render time

## Feature 7: Toolbar Customization
Let users show/hide toolbar buttons.
- Settings dialog accessible from toolbar (gear icon)
- Checkbox list of all toolbar sections
- Save preferences in localStorage
- Hidden buttons don't render
- "Reset to default" option

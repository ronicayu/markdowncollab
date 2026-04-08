# Round 18: Integration & Intelligence

## Feature 1: i18n Framework
Simple i18n with JSON translation files. UI strings only (not document content).
- New: `src/lib/i18n.ts` — translation context, useTranslation hook
- Translation files: `src/locales/{en,es,fr,ja}.json`
- Language selector in TopBar (globe icon)
- Translate: TopBar buttons, sidebar tabs, dialog titles, toolbar tooltips
- Store preference in localStorage

## Feature 2: Document Graph View
Visual map showing relationships between documents.
- New page: `/graph`
- Fetches all docs + their wiki links + forks + backlinks
- Renders as a force-directed graph using simple SVG (no D3 — just CSS/JS)
- Nodes = documents, edges = links/forks
- Click node to navigate to doc
- Color nodes by status (draft/review/approved)

## Feature 3: AI Document Suggestions
"You might want to link to X" based on content overlap.
- New API: POST /api/agent/suggest-links
- Compares current doc keywords with all other doc titles/content
- Uses TF-IDF or simple keyword matching (no ML needed)
- Returns top 3 related documents
- Show as a small "Related docs" panel in sidebar

## Feature 4: Collaborative Drawing Canvas
Simple whiteboard block for quick sketches.
- New extension: `src/extensions/canvas-block.ts`
- Uses HTML5 Canvas with basic drawing tools (pen, eraser, colors)
- Store drawing as base64 PNG in node attributes
- Syncs via Yjs (store as binary data in Y.Map)
- Slash command: `/draw`

## Feature 5: Document Rating
Team members rate documents 1-5 stars.
- New Prisma model: Rating (id, documentId, userId, score: Int, comment?, createdAt)
- API: GET/POST /api/documents/[id]/ratings
- Average rating shown on document list rows
- Rating widget in TopBar (5 stars, click to rate)

## Feature 6: Slack Webhook Preview
Format webhook payloads as rich Slack messages.
- Modify webhook.ts to detect Slack webhook URLs (hooks.slack.com)
- Format payload as Slack Block Kit JSON instead of plain JSON
- Include: document title, author avatar, action description, link button

## Feature 7: Calendar Event Block
Inline block for referencing dates/events.
- New extension: `src/extensions/event-block.ts`
- Attributes: title, date, time, description
- Renders as a styled card with calendar icon
- Slash command: `/event`
- Export as "📅 Event: Title (Date)"

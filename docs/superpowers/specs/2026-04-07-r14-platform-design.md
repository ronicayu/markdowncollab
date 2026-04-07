# Round 14: Platform Features

**Date:** 2026-04-07

## Feature 1: PWA/Offline Support
Service worker for offline access and editing with sync queue.
- Create `public/sw.js` service worker with cache-first strategy
- Cache: app shell, static assets, API responses for document list
- Offline editing: queue mutations in IndexedDB, sync when back online
- Add `manifest.json` for PWA install prompt
- Register SW in layout.tsx
- Show offline indicator in TopBar when disconnected

## Feature 2: Custom Themes
User-created color themes beyond light/dark.
- New: `src/components/ThemeEditor.tsx` — UI to customize colors
- Store theme as JSON in localStorage: accent, background, text, sidebar, toolbar colors
- Apply as CSS variables on :root
- Preset themes: Default Light, Default Dark, Ocean, Forest, Sunset, Midnight
- Theme selector in TopBar alongside light/dark toggle

## Feature 3: Document Timeline View
Visual timeline of all edits, comments, and events for a document.
- New component: `src/components/DocumentTimeline.tsx`
- Fetches from activity log API + version history API
- Renders as vertical timeline: bubbles with event descriptions, timestamps, author avatars
- Filter by event type (edits, comments, shares, versions)
- Accessible from version history panel (new tab: "Timeline")

## Feature 4: Kanban Board View
View documents as cards grouped by approval status.
- New page: `src/app/board/page.tsx`
- Columns: Draft, In Review, Approved (from document status)
- Document cards show: title, last updated, tags, assignee
- Drag cards between columns to change status
- Link from sidebar: "Board View"

## Feature 5: Slash Command Extensions
Users can create custom slash commands that insert predefined content.
- New Prisma model: CustomCommand (id, name, description, content, ownerId)
- API: GET/POST/DELETE /api/commands
- Custom commands appear in slash menu after built-in ones
- Management UI in settings/profile area

## Feature 6: Document Word Cloud
Visual word frequency analysis of a document.
- New component: `src/components/WordCloud.tsx`
- Extracts words from document, counts frequency
- Renders as a word cloud (sized by frequency, random placement)
- Simple CSS approach: inline spans with varying font-size
- Accessible from TopBar or document analytics

## Feature 7: Bulk Tag Operations
Tag or untag multiple selected documents at once.
- When docs are selected (checkboxes), show "Tag selected" button in bulk action bar
- Opens tag popover (same as single-doc tag management)
- Apply selected tags to ALL checked documents
- Remove tags from all checked documents

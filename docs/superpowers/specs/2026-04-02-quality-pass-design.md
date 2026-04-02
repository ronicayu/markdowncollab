# MarkdownCollab Quality Pass — Design Spec

**Goal:** Make the app actually usable — proper editor UX, working collaboration, reliable comments, deployable as a webapp.

**Deployment target:** Next.js on Vercel + WebSocket server on Fly.io/Railway.

---

## 1. Editor UX

### Formatting Toolbar
A sticky toolbar above the editor with buttons for:
- **Text**: Bold, Italic, Strikethrough, Code
- **Block**: Heading 1/2/3 dropdown, Bullet List, Ordered List, Blockquote, Code Block, Horizontal Rule
- Buttons show active state when cursor is inside formatted text
- Toolbar is compact on mobile (icon-only, scrollable)

### Markdown Shortcuts
Enable Tiptap's built-in InputRules:
- `# ` → H1, `## ` → H2, `### ` → H3
- `**text**` → bold, `*text*` → italic
- `- ` → bullet list, `1. ` → ordered list
- `` ``` `` → code block
- `> ` → blockquote
- `---` → horizontal rule

### Typography
- Headings: distinct sizes with bottom borders on H1/H2
- Code blocks: gray background, monospace font, rounded corners
- Inline code: subtle background
- Lists: proper indentation and bullet/number styling
- Blockquotes: left border accent

### Document Title
- Editable title in the top bar (click to edit, blur to save)
- Saves to Prisma `Document.title`
- Shows "Untitled" as placeholder
- Title updates in real-time for all collaborators (store in Yjs shared map)

## 2. Collaboration & Presence

### Cursor Fix
The `@tiptap/extension-collaboration-cursor` v2 crashes with Tiptap v3. Fix by using `y-prosemirror`'s cursor plugin directly:
```ts
import { yCursorPlugin } from 'y-prosemirror'
```
This is the underlying plugin that the Tiptap extension wraps. Using it directly bypasses the version incompatibility.

### Presence
- Each user gets a random color (stored in awareness)
- Cursor shows as a colored line with name label above it
- Top bar avatars update in real-time from awareness

### Connection Status
- Small dot in top bar: green = connected, yellow = reconnecting, red = disconnected
- Auto-reconnect is handled by y-websocket provider

## 3. Comments & Agent

### Mobile Comment Fix
The current implementation loses the editor selection when the bottom sheet opens. Fix:
- Save selection on every `selectionUpdate` (already done via `lastSelectionRef`)
- Use uncontrolled textarea with ref (already done)
- If ref value is empty on submit, fall back to `window.prompt()`

### Invite Agent
- Show loading spinner on the Invite Agent button while the request is in flight
- On success, show a toast "Agent generated N suggestions"
- On error, show a toast with the error message (not alert())
- Disable the button while loading

### Error States
- Toast notification system (simple div that auto-dismisses after 5s)
- Replace all `alert()` calls with toasts
- Show error boundary for unhandled component crashes

## 4. Deployment

### Architecture Split
- **Vercel**: Next.js app (frontend + API routes)
- **Fly.io**: Standalone WebSocket server (`server/ws-server.mjs`)
- API routes that need WS connection (agent/invite, export) use `WS_URL` env var pointing to the Fly.io server

### Environment Variables
**Vercel (.env.production):**
- `NEXT_PUBLIC_WS_URL` — WebSocket server URL (wss://ws.markdowncollab.com or similar)
- `WS_URL` — Internal WS URL for server-side API routes
- `DATABASE_URL` — Prisma database (Vercel Postgres or similar)
- `ANTHROPIC_API_KEY` — Claude API key

**Fly.io:**
- `HOST=0.0.0.0`
- `PORT=8080`
- `YPERSISTENCE=./yjs-data`

### Files to Create
- `Dockerfile` for WS server
- `fly.toml` for Fly.io config
- `vercel.json` (if needed for rewrites)
- Update `next.config.ts` for production

### Local Dev
- `npm run dev` — combined server on port 3000 (current behavior, keep working)
- Production uses split architecture

## 5. Polish

- Loading skeleton on homepage while documents load
- Proper page title (`<title>Document Name - MarkdownCollab</title>`)
- Empty editor placeholder text ("Start typing or paste markdown...")
- Favicon (simple "MC" icon)
- Better homepage design (not just a list)

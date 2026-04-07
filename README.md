# Markdown Collab

A real-time collaborative markdown editor built with Next.js 16, Tiptap 3, and Yjs CRDTs. Multiple users can edit the same document simultaneously with live cursors, inline comments, AI-powered writing assistance, and rich export options.

## Features

### Core Editing
- Rich text formatting (bold, italic, underline, strikethrough, highlight)
- Headings (H1-H6), blockquotes, horizontal rules
- Bullet lists, ordered lists, and task lists with interactive checkboxes
- Code blocks with syntax highlighting and language selector
- Tables with header rows and cell selection
- Image upload and inline display
- Callout/admonition blocks (info, warning, tip, danger)
- Mermaid diagram rendering (flowcharts, sequence diagrams, etc.)
- Slash command menu for quick block insertion
- Find and replace across the document
- Drag handle for block reordering
- Text alignment (left, center, right)
- Keyboard shortcuts dialog

### Collaboration
- Real-time co-editing via Yjs CRDT conflict resolution
- Live remote cursors with user names and colors
- Inline commenting with threaded discussions
- Suggested edits (accept/reject tracked changes)
- Typing indicators
- Document sharing with link-based access and collaborator management
- Version history with snapshot restore

### AI
- Claude-powered AI writing assistant via Anthropic SDK
- MCP (Model Context Protocol) endpoint for tool-use workflows

### Document Management
- Dashboard with document listing, search, and sorting
- Star/favorite documents
- Tag system for organization
- Document templates
- Soft delete with trash and restore
- Command palette (Cmd+P) for quick document switching

### Export
- Markdown export (clean, spec-compliant output)
- HTML export
- PDF export (via Puppeteer server-side rendering)

### Notifications
- In-app notification system for mentions and comments
- Unread count badge

## Quick Start

### Prerequisites
- Node.js 22+
- npm 10+

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd markdown-collab

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create the SQLite database
npx prisma db push

# Copy environment file and configure
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="sk-ant-..."
NEXT_PUBLIC_WS_URL=""
WS_URL="ws://localhost:3000/ws"
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite database path (Prisma) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features |
| `NEXT_PUBLIC_WS_URL` | Public WebSocket URL (leave empty for combined server mode) |
| `WS_URL` | Internal WebSocket URL. Use `ws://localhost:3000/ws` for combined server, `ws://localhost:1234` for standalone WS server |

### Run

```bash
# Combined server (Next.js + WebSocket on port 3000)
npm run dev

# Or run Next.js and WebSocket server separately
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Editor | Tiptap 3 (ProseMirror) |
| Real-time sync | Yjs CRDT + y-websocket |
| UI | React 19, Tailwind CSS 4 |
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js with bcrypt passwords |
| AI | Anthropic Claude SDK |
| PDF export | Puppeteer |
| Diagrams | Mermaid.js |
| Testing | Vitest (unit), Playwright (e2e) |
| Language | TypeScript 5 |

## Architecture

Markdown Collab uses a **CRDT-first architecture** for real-time collaboration. Every document is represented as a Yjs `Y.Doc`, which is a conflict-free replicated data type. When multiple users edit the same document simultaneously, Yjs merges their changes automatically without requiring a central coordination server or operational transforms. The Yjs document state is synchronized between clients and the server over WebSocket connections using the y-websocket protocol.

The **editor layer** is built on Tiptap 3, which wraps ProseMirror with a declarative extension API. Tiptap's collaboration extension bridges the ProseMirror editor state with the Yjs document, so every keystroke is captured as a Yjs update and broadcast to peers. Custom extensions (mermaid diagrams, callout blocks, comment marks, suggestion marks, search-replace) extend the base editor without modifying core Tiptap internals.

The **application shell** is a Next.js 16 App Router project. Server-side API routes handle authentication (NextAuth.js), document CRUD, file uploads, export (markdown/HTML/PDF), version history, tags, templates, and notifications. In development, a combined server (`server/combined-server.mjs`) serves both the Next.js app and the WebSocket endpoint on a single port. The SQLite database (via Prisma) stores document metadata, user accounts, comments, tags, and version snapshots, while the actual document content lives in the Yjs CRDT state.

## Testing

```bash
# Run unit tests (Vitest)
npm test

# Run unit tests in watch mode
npm run test:watch

# Run end-to-end tests (Playwright)
npm run test:e2e

# Run all tests
npm run test:all
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET/POST | `/api/documents` | List all documents / create new |
| GET/PUT/DELETE | `/api/documents/[id]` | Get, update, or soft-delete a document |
| DELETE | `/api/documents/[id]/permanent` | Permanently delete a document |
| POST | `/api/documents/[id]/restore` | Restore a soft-deleted document |
| GET | `/api/documents/search` | Full-text document search |
| GET/POST | `/api/documents/[id]/versions` | List / create version snapshots |
| GET | `/api/documents/[id]/versions/[vid]` | Get a specific version |
| POST | `/api/documents/[id]/versions/[vid]/restore` | Restore a version |
| GET/POST | `/api/documents/[id]/collaborators` | Manage document collaborators |
| GET/POST | `/api/documents/[id]/share` | Manage share permissions |
| POST | `/api/documents/[id]/share-link` | Generate a share link |
| POST/PUT | `/api/documents/[id]/star` | Star/unstar a document |
| GET/POST | `/api/documents/[id]/tags` | Manage document tags |
| POST | `/api/documents/[id]/upload` | Upload an image |
| GET | `/api/documents/[id]/uploads/[filename]` | Serve an uploaded file |
| GET | `/api/documents/[id]/export` | Export as markdown or HTML |
| GET | `/api/documents/[id]/export/pdf` | Export as PDF |
| GET/POST | `/api/tags` | List / create tags |
| GET/POST | `/api/templates` | List / create templates |
| POST | `/api/auth/register` | Register a new user |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth.js auth endpoints |
| POST | `/api/agent/invite` | AI agent invite endpoint |
| POST | `/api/mcp` | MCP tool-use endpoint |
| GET/POST | `/api/notifications` | List / create notifications |
| GET | `/api/notifications/count` | Unread notification count |
| POST | `/api/notifications/read` | Mark notifications as read |
| GET | `/api/notifications/mentions` | List mention notifications |

## Contributing

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run `npm test` to verify unit tests pass
4. Submit a pull request with a clear description

Code style is enforced by ESLint (`npm run lint`). The project uses TypeScript strict mode.

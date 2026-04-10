## Project

Collaborative markdown editor where both human users and AI agents are first-class participants — AI-as-collaborator, not AI-as-tool. Built with Next.js 15, Tiptap 3, Prisma (SQLite), and Yjs over WebSocket.

Path alias: `@/*` → `./src/*`

## Commands

```bash
npm run dev          # Combined Next.js + WebSocket server (port 3000)
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright e2e tests
npm run test:all     # Unit + e2e
npm run lint         # ESLint
```

## Architecture

```
src/app/           # Next.js app router (pages + API routes)
src/components/    # React components (Tiptap editor, dialogs, etc.)
server/            # WebSocket server (combined-server.mjs, ws-server.mjs)
prisma/            # Schema + migrations (SQLite: dev.db)
tests/             # Vitest unit tests
e2e/               # Playwright e2e tests
```

## Environment

Required in `.env`:
- `DATABASE_URL` — Prisma connection string (default: `file:./dev.db`)
- `WS_URL` — WebSocket URL (must match server mode, see gotchas)
- `ANTHROPIC_API_KEY` — For AI features

## Gotchas

- **Tiptap StarterKit conflicts**: StarterKit already includes Link and Underline — don't register them separately. y-prosemirror PluginKey crash if duplicated.
- **WS_URL must match server mode**: Combined server (`npm run dev`) → `ws://localhost:3000/ws`. Standalone WS server → `ws://localhost:1234`.
- **Gitignore trap**: `documents/` in .gitignore catches `src/app/api/documents/` — use `git add -f` for new files there.
- **Turbopack cache**: Stale HTTP methods after route changes need `.next/` cleared. Default export strict checking requires namespace imports.

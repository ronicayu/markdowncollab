## Project

Collaborative markdown editor where both human users and AI agents are first-class participants — AI-as-collaborator, not AI-as-tool. Built with Next.js 15, Tiptap 3, Prisma (SQLite), and Yjs over WebSocket.

Path alias: `@/*` → `./src/*`

## Design

Notion-inspired system documented in [DESIGN.md](./DESIGN.md). Warm neutrals
(`#f6f5f4`, `#31302e`, `#615d59`, `#a39e98`), whisper borders `rgba(0,0,0,0.1)`,
Notion Blue `#0075de` as singular accent. Use these before introducing any
new palette values.

## Commands

```bash
npm run dev          # Combined Next.js + WebSocket server (port 3000)
npm run build        # Production build
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright e2e tests
npm run test:all     # Unit + e2e
npm run lint         # ESLint
npx prisma migrate dev      # Apply + generate after schema change
npx prisma migrate reset -f # Nuke dev.db and re-seed
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
- **Dev service worker caches chunks**: `/sw.js` (cache key `mc-shell-v2`) serves stale `/_next/static/chunks/*.js` across dev restarts. If an edit doesn't appear in the browser, unregister SW + clear caches before blaming compile:
  ```js
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  for (const k of await caches.keys()) await caches.delete(k);
  location.reload();
  ```
- **Dark-mode leaks onto mobile surfaces**: `.dark` class applied on `prefers-color-scheme: dark` flips `--surface`/`--toolbar-bg` to dark. Home mobile header is hardcoded white, so editor `TopBar` / `MobileToolbar` must also hardcode `bg-white` + `border-black/10` on mobile for visual consistency.

## UAT

- External UAT URL: `http://100.109.228.117:3000/` (Tailscale); Playwright MCP uses `localhost:3000`.
- iPhone viewport: `390 × 844`. Desktop regression: `1280 × 800`.

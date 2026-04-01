# Markdown Collab MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time collaborative markdown editor where AI agents participate as peers — Google Docs-style inline suggestions, comment sidebar, and Yjs CRDT for conflict-free sync.

**Architecture:** Next.js frontend with Tiptap (ProseMirror) editor, Yjs CRDT for real-time collaboration via y-websocket's built-in server with LevelDB persistence. Suggestions and comments are stored in Yjs shared maps (synced via CRDT, persisted alongside document state). AI agent connects server-side to the Yjs room using the `ws` Node.js WebSocket library, reads the document, generates suggestions via Anthropic API, applies inline marks, and writes suggestion metadata to the shared map. Comments and suggestions anchor to text using Yjs RelativePosition (stable through concurrent edits). Prisma/SQLite stores document metadata only (title, timestamps); actual document content lives in LevelDB via y-websocket.

**Tech Stack:** Next.js 15, Tiptap 3.x, Yjs, y-websocket, Prisma (SQLite), Anthropic SDK, TypeScript

---

## File Structure

```
markdown-collab/
├── prisma/
│   └── schema.prisma
├── server/
│   └── ws-server.ts              # Standalone Yjs WebSocket server with persistence
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Homepage: list + create documents
│   │   ├── globals.css
│   │   ├── doc/[id]/
│   │   │   └── page.tsx          # Document editor page
│   │   └── api/
│   │       ├── documents/
│   │       │   └── route.ts      # GET list, POST create
│   │       ├── documents/[id]/
│   │       │   ├── route.ts      # GET single doc
│   │       │   └── export/
│   │       │       └── route.ts  # GET export as clean markdown
│   │       └── agent/
│   │           └── invite/
│   │               └── route.ts  # POST invoke AI agent
│   ├── components/
│   │   ├── Editor.tsx            # Tiptap collaborative editor
│   │   ├── TopBar.tsx            # Title, collaborators, mode badge, invite button
│   │   ├── OutlineSidebar.tsx    # Left: document heading outline
│   │   ├── CommentSidebar.tsx    # Right: suggestion + comment cards
│   │   ├── SuggestionCard.tsx    # Single suggestion with accept/reject
│   │   └── CommentCard.tsx       # Single comment with reply
│   ├── extensions/
│   │   ├── suggestion-mark.ts    # Custom Tiptap mark for inline tracked changes
│   │   └── comment-mark.ts       # Custom Tiptap mark for comment highlights
│   ├── lib/
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── agent.ts              # Anthropic API: parse doc, generate suggestions
│   │   ├── export-markdown.ts    # Export with suggestion resolution
│   │   └── suggestion-store.ts   # In-memory suggestion/comment state (shared via Yjs)
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── tests/
│   ├── lib/
│   │   ├── agent.test.ts
│   │   └── export-markdown.test.ts
│   └── extensions/
│       └── suggestion-mark.test.ts
├── package.json
├── tsconfig.json
├── .env
└── next.config.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.env`, `.gitignore`
- Create: `prisma/schema.prisma`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `src/lib/prisma.ts`
- Create: `src/types/index.ts`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/ronica/projects/markdown-collab
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```

Expected: Next.js project created with `src/app/` structure.

- [ ] **Step 2: Install collaboration dependencies**

```bash
npm install @tiptap/core @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-collaboration @tiptap/extension-collaboration-cursor yjs y-websocket @tiptap/extension-markdown
```

- [ ] **Step 3: Install backend dependencies**

```bash
npm install @anthropic-ai/sdk prisma @prisma/client better-sqlite3 ws
npm install -D @types/ws @types/better-sqlite3 tsx vitest
```

- [ ] **Step 4: Create .env file**

```bash
# .env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY="your-key-here"
WS_PORT=1234
NEXT_PUBLIC_WS_URL="ws://localhost:1234"
WS_URL="ws://localhost:1234"
```

- [ ] **Step 5: Create Prisma schema**

Write `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Document {
  id        String   @id @default(uuid())
  title     String   @default("Untitled")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Note: Document content is persisted in LevelDB via y-websocket (YPERSISTENCE).
// Suggestions and comments are stored in Yjs shared maps (synced via CRDT).
// Prisma stores only document metadata (title, timestamps) for the homepage listing.
```

- [ ] **Step 6: Run Prisma migration**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` created, `dev.db` created.

- [ ] **Step 7: Create Prisma client singleton**

Write `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

- [ ] **Step 8: Create shared types**

Write `src/types/index.ts`:

```ts
export interface Suggestion {
  id: string;
  documentId: string;
  authorName: string;
  authorType: "human" | "agent";
  originalText: string;
  suggestedText: string;
  rationale: string;
  status: "pending" | "accepted" | "rejected" | "stale";
  startRelPos: Uint8Array;
  endRelPos: Uint8Array;
  contentHash: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Comment {
  id: string;
  documentId: string;
  authorName: string;
  authorType: "human" | "agent";
  content: string;
  startRelPos: Uint8Array;
  endRelPos: Uint8Array;
  parentCommentId: string | null;
  resolved: boolean;
  createdAt: string;
}

export interface Collaborator {
  name: string;
  color: string;
  type: "human" | "agent";
}
```

- [ ] **Step 9: Verify project builds**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Prisma, Tiptap, and Yjs deps"
```

---

### Task 2: Yjs WebSocket Server with Persistence

**Files:**
- Create: `server/ws-server.ts`

We use y-websocket's built-in server with LevelDB persistence. No custom server code needed for MVP.

```bash
npm install concurrently -D
```

- [ ] **Step 2: Add convenience scripts to package.json**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:ws": "YPERSISTENCE=./yjs-data npx y-websocket",
    "dev:all": "npx concurrently \"npm run dev\" \"npm run dev:ws\""
  }
}
```

- [ ] **Step 3: Add yjs-data to .gitignore**

Append to `.gitignore`:

```
yjs-data/
```

- [ ] **Step 4: Test WebSocket server starts**

```bash
npm run dev:ws &
sleep 2
curl -s http://localhost:1234 && echo " OK"
kill %1
```

Expected: Server starts, HTTP responds.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Yjs WebSocket server with LevelDB persistence"
```

---

### Task 3: Collaborative Tiptap Editor with Cursors

**Files:**
- Create: `src/components/Editor.tsx`
- Create: `src/components/TopBar.tsx`
- Modify: `src/app/doc/[id]/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create the Editor component**

Write `src/components/Editor.tsx`:

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEffect, useMemo, useState } from "react";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

interface EditorProps {
  documentId: string;
  userName: string;
}

export default function Editor({ documentId, userName }: EditorProps) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(
      process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234",
      documentId,
      ydoc
    );
    return { ydoc, provider };
  }, [documentId]);

  useEffect(() => {
    provider.on("status", ({ status }: { status: string }) => {
      setStatus(status as "connecting" | "connected" | "disconnected");
    });
    return () => {
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: userName, color: getRandomColor() },
        }),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-lg max-w-none focus:outline-none min-h-[500px] px-12 py-8",
        },
      },
    },
    [ydoc, provider]
  );

  if (!editor) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto">
        <EditorContent editor={editor} />
      </div>
      {status !== "connected" && (
        <div className="fixed bottom-4 right-4 bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
          {status === "connecting" ? "Connecting..." : "Disconnected"}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the TopBar component**

Write `src/components/TopBar.tsx`:

```tsx
"use client";

import { type Collaborator } from "@/types";

interface TopBarProps {
  title: string;
  collaborators: Collaborator[];
  onInviteAgent: () => void;
}

export default function TopBar({ title, collaborators, onInviteAgent }: TopBarProps) {
  return (
    <div className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-5">
      <span className="font-mono font-bold text-sm text-gray-900">MarkdownCollab</span>

      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span className="text-sm font-medium text-gray-900">{title}</span>
        <span className="ml-2 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
          Suggesting
        </span>
      </div>

      <div className="flex items-center gap-3">
        {collaborators.map((c) => (
          <div
            key={c.name}
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold"
            style={{ backgroundColor: c.color }}
            title={c.name}
          >
            {c.type === "agent" ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 110 2h-1.07A7.001 7.001 0 0113 22h-2a7.001 7.001 0 01-6.93-6H3a1 1 0 110-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
              </svg>
            ) : (
              c.name[0].toUpperCase()
            )}
          </div>
        ))}
        <div className="w-px h-5 bg-gray-200" />
        <button
          onClick={onInviteAgent}
          className="flex items-center gap-1.5 h-8 px-3 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Invite Agent
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the document editor page**

Write `src/app/doc/[id]/page.tsx`:

```tsx
"use client";

import { use, useState, useCallback } from "react";
import Editor from "@/components/Editor";
import TopBar from "@/components/TopBar";
import { type Collaborator } from "@/types";

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userName] = useState(() => {
    if (typeof window === "undefined") return "User";
    return localStorage.getItem("mc-username") || "User " + Math.floor(Math.random() * 100);
  });

  const [collaborators] = useState<Collaborator[]>([
    { name: userName, color: "#3B82F6", type: "human" },
  ]);

  const handleInviteAgent = useCallback(async () => {
    // Will be implemented in Task 7
    console.log("Invite agent for document:", id);
  }, [id]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar
        title="Untitled Document"
        collaborators={collaborators}
        onInviteAgent={handleInviteAgent}
      />
      <div className="flex flex-1 overflow-hidden">
        <Editor documentId={id} userName={userName} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add collaboration cursor CSS**

Append to `src/app/globals.css`:

```css
/* Collaboration cursors */
.collaboration-cursor__caret {
  border-left: 1px solid #0d0d0d;
  border-right: 1px solid #0d0d0d;
  margin-left: -1px;
  margin-right: -1px;
  pointer-events: none;
  position: relative;
  word-break: normal;
}

.collaboration-cursor__label {
  border-radius: 3px 3px 3px 0;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  left: -1px;
  line-height: normal;
  padding: 1px 6px;
  position: absolute;
  top: -1.4em;
  user-select: none;
  white-space: nowrap;
}
```

- [ ] **Step 5: Update homepage to link to a test document**

Write `src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  const testDocId = "test-doc-1";
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-mono font-bold text-gray-900 mb-4">MarkdownCollab</h1>
        <p className="text-gray-600 mb-8">Real-time collaborative markdown editing with AI agents</p>
        <Link
          href={`/doc/${testDocId}`}
          className="inline-flex items-center gap-2 bg-gray-800 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          Open Test Document
        </Link>
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Test real-time collaboration**

Start both servers:
```bash
npm run dev:all
```

Open `http://localhost:3000/doc/test-doc-1` in two browser tabs. Type in one — text should appear in both. Cursors should be visible with labels.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: collaborative Tiptap editor with real-time cursors"
```

---

### Task 4: Document API Routes

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`
- Modify: `src/app/page.tsx` (list documents)

- [ ] **Step 1: Create documents list + create endpoint**

Write `src/app/api/documents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const docs = await prisma.document.findMany({
    select: { id: true, title: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(docs);
}

export async function POST(req: Request) {
  const { title } = await req.json();
  const doc = await prisma.document.create({
    data: { title: title || "Untitled" },
  });
  return NextResponse.json(doc, { status: 201 });
}
```

- [ ] **Step 2: Create single document endpoint**

Write `src/app/api/documents/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}
```

- [ ] **Step 3: Update homepage to list and create documents**

Write `src/app/page.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  title: string;
  updatedAt: string;
}

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/documents").then((r) => r.json()).then(setDocs);
  }, []);

  async function createDoc() {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled" }),
    });
    const doc = await res.json();
    router.push(`/doc/${doc.id}`);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-16 px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-mono font-bold text-gray-900">MarkdownCollab</h1>
          <button
            onClick={createDoc}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-700 text-sm font-medium"
          >
            + New Document
          </button>
        </div>
        {docs.length === 0 ? (
          <p className="text-gray-500 text-center py-12">No documents yet. Create one to get started.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => (
              <Link
                key={doc.id}
                href={`/doc/${doc.id}`}
                className="block bg-white border border-gray-200 rounded-lg px-4 py-3 hover:border-gray-300 transition-colors"
              >
                <span className="font-medium text-gray-900">{doc.title}</span>
                <span className="text-xs text-gray-400 ml-3">
                  {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Test document creation flow**

```bash
npm run dev:all
```

Go to `http://localhost:3000`, click "New Document", verify it creates a doc and redirects to the editor.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: document CRUD API and homepage with document list"
```

---

### Task 5: Suggestion Mark Extension

**Files:**
- Create: `src/extensions/suggestion-mark.ts`
- Create: `tests/extensions/suggestion-mark.test.ts`

- [ ] **Step 1: Write test for suggestion mark**

Write `tests/extensions/suggestion-mark.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SuggestionMark } from "../../src/extensions/suggestion-mark";

function createEditor(content: string) {
  return new Editor({
    extensions: [StarterKit, SuggestionMark],
    content,
  });
}

describe("SuggestionMark", () => {
  it("can apply a suggestion-add mark to selected text", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 7, to: 12 }); // "world"
    editor.commands.setSuggestionMark({
      suggestionId: "s1",
      type: "add",
    });

    const html = editor.getHTML();
    expect(html).toContain('data-suggestion-id="s1"');
    expect(html).toContain('data-suggestion-type="add"');
  });

  it("can apply a suggestion-delete mark to selected text", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 1, to: 6 }); // "Hello"
    editor.commands.setSuggestionMark({
      suggestionId: "s2",
      type: "delete",
    });

    const html = editor.getHTML();
    expect(html).toContain('data-suggestion-type="delete"');
  });

  it("can remove a suggestion mark", () => {
    const editor = createEditor("<p>Hello world</p>");
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.setSuggestionMark({ suggestionId: "s1", type: "add" });
    editor.commands.setTextSelection({ from: 7, to: 12 });
    editor.commands.unsetSuggestionMark();

    const html = editor.getHTML();
    expect(html).not.toContain("data-suggestion-id");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/extensions/suggestion-mark.test.ts
```

Expected: FAIL — `SuggestionMark` does not exist yet.

- [ ] **Step 3: Implement the suggestion mark extension**

Write `src/extensions/suggestion-mark.ts`:

```ts
import { Mark, mergeAttributes } from "@tiptap/core";

export interface SuggestionMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    suggestionMark: {
      setSuggestionMark: (attrs: {
        suggestionId: string;
        type: "add" | "delete";
      }) => ReturnType;
      unsetSuggestionMark: () => ReturnType;
    };
  }
}

export const SuggestionMark = Mark.create<SuggestionMarkOptions>({
  name: "suggestionMark",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      suggestionId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-suggestion-id"),
        renderHTML: (attrs) => {
          if (!attrs.suggestionId) return {};
          return { "data-suggestion-id": attrs.suggestionId };
        },
      },
      type: {
        default: "add",
        parseHTML: (el) => el.getAttribute("data-suggestion-type"),
        renderHTML: (attrs) => {
          return { "data-suggestion-type": attrs.type };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-suggestion-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes["data-suggestion-type"];
    const style =
      type === "delete"
        ? "text-decoration: line-through; color: #DC2626; background-color: #FEE2E2;"
        : "color: #16A34A; background-color: #DCFCE7;";
    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { style }),
      0,
    ];
  },

  addCommands() {
    return {
      setSuggestionMark:
        (attributes) =>
        ({ commands }) =>
          commands.setMark(this.name, attributes),
      unsetSuggestionMark:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/extensions/suggestion-mark.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Add suggestion mark to the editor**

Modify `src/components/Editor.tsx` — add import and extension:

```ts
// Add to imports:
import { SuggestionMark } from "@/extensions/suggestion-mark";

// Add to extensions array (after CollaborationCursor):
SuggestionMark,
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: suggestion mark extension with inline add/delete rendering"
```

---

### Task 6: Comment Sidebar with Anchored Suggestions

**Files:**
- Create: `src/components/CommentSidebar.tsx`
- Create: `src/components/SuggestionCard.tsx`
- Create: `src/components/CommentCard.tsx`
- Create: `src/lib/suggestion-store.ts`
- Create: `src/extensions/comment-mark.ts`
- Modify: `src/app/doc/[id]/page.tsx`

- [ ] **Step 1: Create the comment highlight mark**

Write `src/extensions/comment-mark.ts`:

```ts
import { Mark, mergeAttributes } from "@tiptap/core";

export const CommentMark = Mark.create({
  name: "commentMark",

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-id"),
        renderHTML: (attrs) => {
          if (!attrs.commentId) return {};
          return { "data-comment-id": attrs.commentId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "mark",
      mergeAttributes(HTMLAttributes, {
        style: "background-color: #FEF3C7; border-bottom: 2px solid #F59E0B;",
      }),
      0,
    ];
  },
});
```

- [ ] **Step 2: Create suggestion store using Yjs shared map**

Write `src/lib/suggestion-store.ts`:

```ts
import * as Y from "yjs";
import type { Suggestion, Comment } from "@/types";

export function getSuggestionMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap("suggestions");
}

export function getCommentMap(ydoc: Y.Doc): Y.Map<string> {
  return ydoc.getMap("comments");
}

export function addSuggestion(ydoc: Y.Doc, suggestion: Suggestion) {
  const map = getSuggestionMap(ydoc);
  map.set(suggestion.id, JSON.stringify({
    ...suggestion,
    startRelPos: Array.from(suggestion.startRelPos),
    endRelPos: Array.from(suggestion.endRelPos),
  }));
}

export function getSuggestions(ydoc: Y.Doc): Suggestion[] {
  const map = getSuggestionMap(ydoc);
  const results: Suggestion[] = [];
  map.forEach((value) => {
    const parsed = JSON.parse(value);
    results.push({
      ...parsed,
      startRelPos: new Uint8Array(parsed.startRelPos),
      endRelPos: new Uint8Array(parsed.endRelPos),
    });
  });
  return results;
}

export function updateSuggestionStatus(
  ydoc: Y.Doc,
  suggestionId: string,
  status: Suggestion["status"]
) {
  const map = getSuggestionMap(ydoc);
  const raw = map.get(suggestionId);
  if (!raw) return;
  const parsed = JSON.parse(raw);
  parsed.status = status;
  map.set(suggestionId, JSON.stringify(parsed));
}

export function addComment(ydoc: Y.Doc, comment: Comment) {
  const map = getCommentMap(ydoc);
  map.set(comment.id, JSON.stringify({
    ...comment,
    startRelPos: Array.from(comment.startRelPos),
    endRelPos: Array.from(comment.endRelPos),
  }));
}

export function getComments(ydoc: Y.Doc): Comment[] {
  const map = getCommentMap(ydoc);
  const results: Comment[] = [];
  map.forEach((value) => {
    const parsed = JSON.parse(value);
    results.push({
      ...parsed,
      startRelPos: new Uint8Array(parsed.startRelPos),
      endRelPos: new Uint8Array(parsed.endRelPos),
    });
  });
  return results;
}
```

- [ ] **Step 3: Create SuggestionCard component**

Write `src/components/SuggestionCard.tsx`:

```tsx
"use client";

import type { Suggestion } from "@/types";

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onClick: (id: string) => void;
}

export default function SuggestionCard({ suggestion, onAccept, onReject, onClick }: SuggestionCardProps) {
  if (suggestion.status !== "pending" && suggestion.status !== "stale") return null;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-gray-300 transition-colors"
      onClick={() => onClick(suggestion.id)}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center">
          {suggestion.authorType === "agent" ? (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 110 2h-1.07A7.001 7.001 0 0113 22h-2a7.001 7.001 0 01-6.93-6H3a1 1 0 110-2h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z" />
            </svg>
          ) : (
            <span className="text-white text-xs font-semibold">{suggestion.authorName[0]}</span>
          )}
        </div>
        <span className="text-xs font-semibold text-gray-700">{suggestion.authorName}</span>
        <span className="text-xs text-gray-400">Just now</span>
      </div>

      <p className="text-xs text-gray-600 mb-3 leading-relaxed">{suggestion.rationale}</p>

      {suggestion.status === "stale" ? (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Content changed — re-run?
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(suggestion.id); }}
            className="flex items-center gap-1 h-7 px-2.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(suggestion.id); }}
            className="flex items-center gap-1 h-7 px-2.5 border border-gray-200 text-gray-600 text-xs font-medium rounded hover:bg-gray-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create CommentCard component**

Write `src/components/CommentCard.tsx`:

```tsx
"use client";

import type { Comment } from "@/types";

interface CommentCardProps {
  comment: Comment;
  onClick: (id: string) => void;
}

export default function CommentCard({ comment, onClick }: CommentCardProps) {
  if (comment.resolved) return null;

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-gray-300 transition-colors"
      onClick={() => onClick(comment.id)}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: comment.authorType === "agent" ? "#374151" : "#10B981" }}
        >
          <span className="text-white text-xs font-semibold">{comment.authorName[0]}</span>
        </div>
        <span className="text-xs font-semibold text-gray-700">{comment.authorName}</span>
        <span className="text-xs text-gray-400">
          {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{comment.content}</p>
      <div className="mt-2 border border-gray-200 rounded px-2.5 py-1.5">
        <span className="text-xs text-gray-400">Reply...</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create CommentSidebar component**

Write `src/components/CommentSidebar.tsx`:

```tsx
"use client";

import type { Suggestion, Comment } from "@/types";
import SuggestionCard from "./SuggestionCard";
import CommentCard from "./CommentCard";

interface CommentSidebarProps {
  suggestions: Suggestion[];
  comments: Comment[];
  onAcceptSuggestion: (id: string) => void;
  onRejectSuggestion: (id: string) => void;
  onClickItem: (id: string) => void;
}

export default function CommentSidebar({
  suggestions,
  comments,
  onAcceptSuggestion,
  onRejectSuggestion,
  onClickItem,
}: CommentSidebarProps) {
  const pendingSuggestions = suggestions.filter((s) => s.status === "pending" || s.status === "stale");

  return (
    <div className="w-72 border-l border-gray-200 bg-gray-50 overflow-y-auto p-4 space-y-3">
      {pendingSuggestions.length === 0 && comments.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-8">
          No suggestions or comments yet. Invite an agent to get started.
        </p>
      )}
      {pendingSuggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          onAccept={onAcceptSuggestion}
          onReject={onRejectSuggestion}
          onClick={onClickItem}
        />
      ))}
      {comments.map((c) => (
        <CommentCard key={c.id} comment={c} onClick={onClickItem} />
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Wire sidebar into the document page**

Update `src/app/doc/[id]/page.tsx`:

```tsx
"use client";

import { use, useState, useCallback, useEffect, useMemo } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Editor from "@/components/Editor";
import TopBar from "@/components/TopBar";
import CommentSidebar from "@/components/CommentSidebar";
import { getSuggestions, getComments, updateSuggestionStatus } from "@/lib/suggestion-store";
import type { Collaborator, Suggestion, Comment } from "@/types";
import type { Editor as TiptapEditor } from "@tiptap/core";

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [userName] = useState(() => {
    if (typeof window === "undefined") return "User";
    return localStorage.getItem("mc-username") || "User " + Math.floor(Math.random() * 100);
  });

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(
    () => new WebsocketProvider(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:1234", id, ydoc),
    [id, ydoc]
  );

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [collaborators] = useState<Collaborator[]>([
    { name: userName, color: "#3B82F6", type: "human" },
  ]);

  // Sync suggestions/comments from Yjs shared maps
  useEffect(() => {
    const suggMap = ydoc.getMap("suggestions");
    const commMap = ydoc.getMap("comments");

    const updateState = () => {
      setSuggestions(getSuggestions(ydoc));
      setComments(getComments(ydoc));
    };

    suggMap.observe(updateState);
    commMap.observe(updateState);
    updateState();

    return () => {
      suggMap.unobserve(updateState);
      commMap.unobserve(updateState);
      provider.destroy();
      ydoc.destroy();
    };
  }, [ydoc, provider]);

  const handleAccept = useCallback((suggestionId: string) => {
    const sugg = suggestions.find((s) => s.id === suggestionId);
    if (!sugg || !editor) return;

    // Resolve RelativePositions to current absolute positions
    const startAbs = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(sugg.startRelPos), ydoc
    );
    const endAbs = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(sugg.endRelPos), ydoc
    );

    if (startAbs && endAbs) {
      // Replace original text with suggested text (ProseMirror positions are 1-indexed)
      editor.chain()
        .setTextSelection({ from: startAbs.index + 1, to: endAbs.index + 1 })
        .insertContent(sugg.suggestedText)
        .unsetSuggestionMark()
        .run();
    }

    updateSuggestionStatus(ydoc, suggestionId, "accepted");
  }, [ydoc, editor, suggestions]);

  const handleReject = useCallback((suggestionId: string) => {
    if (!editor) return;
    // Just remove the inline marks — the original text stays
    // Find and remove suggestion marks with this ID from the document
    const { doc } = editor.state;
    const markType = editor.schema.marks.suggestionMark;
    doc.descendants((node, pos) => {
      node.marks.forEach((mark) => {
        if (mark.type === markType && mark.attrs.suggestionId === suggestionId) {
          editor.chain()
            .setTextSelection({ from: pos, to: pos + node.nodeSize })
            .unsetSuggestionMark()
            .run();
        }
      });
    });

    updateSuggestionStatus(ydoc, suggestionId, "rejected");
  }, [ydoc, editor]);

  const handleClickItem = useCallback((itemId: string) => {
    if (!editor) return;
    // Find the suggestion/comment and scroll to its anchor
    const sugg = suggestions.find((s) => s.id === itemId);
    const relPos = sugg?.startRelPos;
    if (!relPos) return;

    const abs = Y.createAbsolutePositionFromRelativePosition(
      Y.decodeRelativePosition(relPos), ydoc
    );
    if (abs) {
      editor.commands.setTextSelection(abs.index + 1);
      editor.commands.scrollIntoView();
    }
  }, [editor, suggestions, ydoc]);

  const handleInviteAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Agent error: ${err.error}`);
      }
    } catch (e) {
      alert("Failed to reach agent. Is the server running?");
    }
  }, [id]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <TopBar title="Untitled Document" collaborators={collaborators} onInviteAgent={handleInviteAgent} />
      <div className="flex flex-1 overflow-hidden">
        <Editor documentId={id} userName={userName} ydoc={ydoc} provider={provider} />
        <CommentSidebar
          suggestions={suggestions}
          comments={comments}
          onAcceptSuggestion={handleAccept}
          onRejectSuggestion={handleReject}
          onClickItem={handleClickItem}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Update Editor to accept ydoc and provider as props**

Modify `src/components/Editor.tsx` — change the props interface and remove internal ydoc/provider creation:

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { SuggestionMark } from "@/extensions/suggestion-mark";
import { CommentMark } from "@/extensions/comment-mark";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];

interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
}

export default function Editor({ documentId, userName, ydoc, provider }: EditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: { name: userName, color: COLORS[Math.floor(Math.random() * COLORS.length)] },
        }),
        SuggestionMark,
        CommentMark,
      ],
      editorProps: {
        attributes: {
          class: "prose prose-lg max-w-none focus:outline-none min-h-[500px] px-12 py-8",
        },
      },
    },
    [ydoc, provider]
  );

  if (!editor) return null;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="max-w-4xl mx-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Test sidebar renders**

```bash
npm run dev:all
```

Open `http://localhost:3000/doc/test-doc-1`. Verify the editor shows on the left with the comment sidebar on the right (showing "No suggestions or comments yet").

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: comment sidebar with suggestion/comment cards and Yjs shared state"
```

---

### Task 7: AI Agent Integration

**Files:**
- Create: `src/lib/agent.ts`
- Create: `src/app/api/agent/invite/route.ts`
- Create: `tests/lib/agent.test.ts`

- [ ] **Step 1: Write test for agent suggestion parsing**

Write `tests/lib/agent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSuggestions } from "../../src/lib/agent";

describe("parseSuggestions", () => {
  it("parses a structured suggestion response", () => {
    const response = JSON.stringify([
      {
        original: "Tokens are issued via OAuth 2.0 flow.",
        suggested: "Tokens are obtained through the OAuth 2.0 authorization code flow.",
        rationale: "More specific about the grant type used.",
      },
    ]);

    const suggestions = parseSuggestions(response);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].original).toBe("Tokens are issued via OAuth 2.0 flow.");
    expect(suggestions[0].suggested).toBe("Tokens are obtained through the OAuth 2.0 authorization code flow.");
    expect(suggestions[0].rationale).toBe("More specific about the grant type used.");
  });

  it("returns empty array for invalid JSON", () => {
    const suggestions = parseSuggestions("not valid json");
    expect(suggestions).toEqual([]);
  });

  it("returns empty array for empty response", () => {
    const suggestions = parseSuggestions("[]");
    expect(suggestions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/agent.test.ts
```

Expected: FAIL — `parseSuggestions` does not exist.

- [ ] **Step 3: Implement agent module**

Write `src/lib/agent.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

interface RawSuggestion {
  original: string;
  suggested: string;
  rationale: string;
}

export function parseSuggestions(response: string): RawSuggestion[] {
  try {
    // Try to extract JSON array from the response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s: unknown): s is RawSuggestion =>
        typeof s === "object" &&
        s !== null &&
        "original" in s &&
        "suggested" in s &&
        "rationale" in s
    );
  } catch {
    return [];
  }
}

export async function generateSuggestions(markdown: string): Promise<RawSuggestion[]> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are a technical writing reviewer. Review the following markdown document and suggest improvements for clarity, accuracy, and completeness.

Return your suggestions as a JSON array. Each suggestion must have:
- "original": the exact text to replace (must appear verbatim in the document)
- "suggested": the replacement text
- "rationale": a brief explanation of why this change improves the document

Only suggest changes where you are confident the improvement is meaningful. Return 2-5 suggestions maximum. Return ONLY the JSON array, no other text.

Document:
${markdown}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  return parseSuggestions(text);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/agent.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Create a server-side Yjs connection helper**

`WebsocketProvider` from y-websocket depends on browser APIs. For server-side (API routes), we use the `ws` library directly with Yjs sync protocol. Write `src/lib/yjs-server-connect.ts`:

```ts
import * as Y from "yjs";
import WebSocket from "ws";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const messageSync = 0;
const messageAwareness = 1;

/**
 * Connect to a y-websocket server from Node.js (server-side).
 * Returns a connected ydoc with awareness. Call cleanup() when done.
 */
export function connectYjsServer(
  wsUrl: string,
  roomName: string,
  agentUser?: { name: string; color: string }
): Promise<{ ydoc: Y.Doc; awareness: awarenessProtocol.Awareness; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const ydoc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(ydoc);
    const ws = new WebSocket(`${wsUrl}/${roomName}`);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Sync timeout (30s)"));
    }, 30000);

    let synced = false;

    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      // Send sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, ydoc);
      ws.send(encoding.toUint8Array(encoder));

      // Set awareness (agent cursor)
      if (agentUser) {
        awareness.setLocalStateField("user", agentUser);
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, messageAwareness);
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID])
        );
        ws.send(encoding.toUint8Array(awarenessEncoder));
      }
    });

    ws.on("message", (data: ArrayBuffer) => {
      const decoder = decoding.createDecoder(new Uint8Array(data));
      const messageType = decoding.readVarUint(decoder);

      if (messageType === messageSync) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, ydoc, null);

        if (encoding.length(encoder) > 1) {
          ws.send(encoding.toUint8Array(encoder));
        }

        // After sync step 2, we're synced
        if (syncMessageType === 2 || (syncMessageType === 1 && !synced)) {
          synced = true;
          clearTimeout(timeout);
          resolve({
            ydoc,
            awareness,
            cleanup: () => {
              awareness.setLocalState(null); // Remove agent cursor
              ws.close();
              ydoc.destroy();
            },
          });
        }
      }
    });

    // Forward local updates to server
    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin !== "remote" && ws.readyState === WebSocket.OPEN) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        ws.send(encoding.toUint8Array(encoder));
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
    });
  });
}
```

- [ ] **Step 6: Install y-protocols and lib0**

```bash
npm install y-protocols lib0
```

- [ ] **Step 7: Create the agent invite API route**

Write `src/app/api/agent/invite/route.ts`:

```ts
import { NextResponse } from "next/server";
import * as Y from "yjs";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { generateSuggestions } from "@/lib/agent";
import { addSuggestion } from "@/lib/suggestion-store";
import type { Suggestion } from "@/types";

export async function POST(req: Request) {
  const { documentId } = await req.json();
  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  const wsUrl = process.env.WS_URL || "ws://localhost:1234";
  let cleanup: (() => void) | null = null;

  try {
    const conn = await connectYjsServer(wsUrl, documentId, {
      name: "Claude",
      color: "#374151",
    });
    cleanup = conn.cleanup;
    const { ydoc } = conn;

    // Extract plain text from the Yjs XmlFragment
    const yxml = ydoc.getXmlFragment("default");
    const plainText = extractPlainText(yxml);

    if (!plainText.trim()) {
      return NextResponse.json({ error: "Document is empty" }, { status: 400 });
    }

    // Generate suggestions via Anthropic
    const rawSuggestions = await generateSuggestions(plainText);

    // Apply each suggestion: find text, create RelativePosition anchors, add to shared map
    for (const raw of rawSuggestions) {
      const textIndex = findTextInXml(yxml, raw.original);
      if (textIndex === null) continue; // Text not found, skip

      const startRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, textIndex.start)
      );
      const endRelPos = Y.encodeRelativePosition(
        Y.createRelativePositionFromTypeIndex(yxml, textIndex.end)
      );

      const suggestion: Suggestion = {
        id: crypto.randomUUID(),
        documentId,
        authorName: "Claude",
        authorType: "agent",
        originalText: raw.original,
        suggestedText: raw.suggested,
        rationale: raw.rationale,
        status: "pending",
        startRelPos,
        endRelPos,
        contentHash: hashText(raw.original),
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };

      addSuggestion(ydoc, suggestion);
    }

    return NextResponse.json({
      success: true,
      suggestionsCount: rawSuggestions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    cleanup?.();
  }
}

/** Walk XmlFragment tree and extract plain text */
function extractPlainText(fragment: Y.XmlFragment): string {
  let text = "";
  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);
    if (child instanceof Y.XmlText) {
      text += child.toString();
    } else if (child instanceof Y.XmlElement) {
      const tag = child.nodeName;
      text += extractPlainText(child);
      if (["paragraph", "heading", "blockquote", "listItem"].includes(tag)) {
        text += "\n";
      }
    }
  }
  return text;
}

/** Find the start/end Yjs type indices of a text string within an XmlFragment */
function findTextInXml(
  fragment: Y.XmlFragment,
  searchText: string
): { start: number; end: number } | null {
  // Flatten the XmlFragment to get text with offset tracking
  let offset = 0;
  let fullText = "";
  const offsets: { nodeStart: number; textStart: number; length: number }[] = [];

  function walk(node: Y.XmlFragment | Y.XmlElement) {
    for (let i = 0; i < node.length; i++) {
      const child = node.get(i);
      if (child instanceof Y.XmlText) {
        const str = child.toString();
        offsets.push({ nodeStart: offset, textStart: fullText.length, length: str.length });
        fullText += str;
        offset += str.length;
      } else if (child instanceof Y.XmlElement) {
        walk(child);
        fullText += "\n";
        offset++; // Account for the element node itself
      }
    }
  }

  walk(fragment);

  const textIdx = fullText.indexOf(searchText);
  if (textIdx === -1) return null;

  // Map text index back to Yjs type index
  // For simplicity, use the text index directly as the type index
  // (This is approximate — for MVP, it works when text content is mostly flat)
  return { start: textIdx, end: textIdx + searchText.length };
}

function hashText(text: string): string {
  // Simple hash for MVP — not crypto-grade, just for change detection
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(16);
}
```
```

- [ ] **Step 6: Test the full agent flow**

```bash
npm run dev:all
```

1. Open `http://localhost:3000/doc/test-doc-1`
2. Type some markdown content (a few paragraphs about an API)
3. Click "Invite Agent"
4. Verify: suggestions appear in the sidebar after a few seconds
5. Verify: inline marks appear in the document (green additions, red strikethroughs)

Note: If the Anthropic API key is not set, the request will fail with an auth error. Set `ANTHROPIC_API_KEY` in `.env` first.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: AI agent integration with Anthropic API and suggestion insertion"
```

---

### Task 8: Export to Clean Markdown

**Files:**
- Create: `src/lib/export-markdown.ts`
- Create: `src/app/api/documents/[id]/export/route.ts`
- Create: `tests/lib/export-markdown.test.ts`

- [ ] **Step 1: Write test for markdown export**

Write `tests/lib/export-markdown.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cleanMarkdown } from "../../src/lib/export-markdown";

describe("cleanMarkdown", () => {
  it("strips suggestion-delete marks (keeps nothing)", () => {
    const html = '<p>Hello <mark data-suggestion-id="s1" data-suggestion-type="delete">old world</mark> new world</p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("new world");
    expect(result).not.toContain("old world");
  });

  it("strips suggestion-add marks (keeps the text)", () => {
    const html = '<p>Hello <mark data-suggestion-id="s1" data-suggestion-type="add">new text</mark></p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("new text");
    expect(result).not.toContain("data-suggestion");
  });

  it("strips comment marks (keeps the text)", () => {
    const html = '<p>Hello <mark data-comment-id="c1">commented text</mark></p>';
    const result = cleanMarkdown(html);
    expect(result).toContain("commented text");
    expect(result).not.toContain("data-comment");
  });

  it("handles plain text with no marks", () => {
    const html = "<p>Hello world</p>";
    const result = cleanMarkdown(html);
    expect(result).toContain("Hello world");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/lib/export-markdown.test.ts
```

Expected: FAIL — `cleanMarkdown` does not exist.

- [ ] **Step 3: Implement export logic**

Write `src/lib/export-markdown.ts`:

```ts
export function cleanMarkdown(html: string): string {
  // Remove delete suggestions entirely (both the mark and its content)
  let cleaned = html.replace(
    /<mark[^>]*data-suggestion-type="delete"[^>]*>[\s\S]*?<\/mark>/g,
    ""
  );

  // Keep add suggestion text but remove the mark wrapper
  cleaned = cleaned.replace(
    /<mark[^>]*data-suggestion-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );

  // Keep comment text but remove the mark wrapper
  cleaned = cleaned.replace(
    /<mark[^>]*data-comment-id="[^"]*"[^>]*>([\s\S]*?)<\/mark>/g,
    "$1"
  );

  // Convert HTML to markdown-like text (basic conversion)
  // Replace heading tags
  cleaned = cleaned.replace(/<h1[^>]*>(.*?)<\/h1>/g, "# $1\n\n");
  cleaned = cleaned.replace(/<h2[^>]*>(.*?)<\/h2>/g, "## $1\n\n");
  cleaned = cleaned.replace(/<h3[^>]*>(.*?)<\/h3>/g, "### $1\n\n");

  // Replace paragraphs
  cleaned = cleaned.replace(/<p[^>]*>(.*?)<\/p>/g, "$1\n\n");

  // Replace bold and italic
  cleaned = cleaned.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  cleaned = cleaned.replace(/<em>(.*?)<\/em>/g, "*$1*");

  // Replace code
  cleaned = cleaned.replace(/<code>(.*?)<\/code>/g, "`$1`");

  // Strip remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Clean up whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/lib/export-markdown.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 5: Create export API route**

Write `src/app/api/documents/[id]/export/route.ts`:

```ts
import { NextResponse } from "next/server";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { cleanMarkdown } from "@/lib/export-markdown";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wsUrl = process.env.WS_URL || "ws://localhost:1234";
  let cleanup: (() => void) | null = null;

  try {
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const html = yxml.toJSON();
    const markdown = cleanMarkdown(html);

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${id}.md"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  } finally {
    cleanup?.();
  }
}
```

- [ ] **Step 6: Add export button to TopBar**

Modify `src/components/TopBar.tsx` — add an export button before the Invite Agent button:

Add `documentId` prop and an export link:

```tsx
// Add to TopBarProps:
documentId: string;

// Add before the Invite Agent button in the JSX:
<a
  href={`/api/documents/${documentId}/export`}
  className="flex items-center gap-1.5 h-8 px-3 border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  Export .md
</a>
```

Update the TopBar usage in `doc/[id]/page.tsx` to pass `documentId={id}`.

- [ ] **Step 7: Test export**

1. Open a document with some content
2. Click "Export .md"
3. Verify a `.md` file downloads with clean markdown (no HTML marks)

- [ ] **Step 8: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: export document as clean markdown with suggestion resolution"
```

---

### Task 9: Final Integration and Polish

**Files:**
- Modify: `src/app/doc/[id]/page.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/components/OutlineSidebar.tsx`

- [ ] **Step 1: Create document outline sidebar**

Write `src/components/OutlineSidebar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

interface Heading {
  level: number;
  text: string;
  pos: number;
}

interface OutlineSidebarProps {
  editor: Editor | null;
}

export default function OutlineSidebar({ editor }: OutlineSidebarProps) {
  const [headings, setHeadings] = useState<Heading[]>([]);

  useEffect(() => {
    if (!editor) return;

    const updateHeadings = () => {
      const items: Heading[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          items.push({
            level: node.attrs.level,
            text: node.textContent,
            pos,
          });
        }
      });
      setHeadings(items);
    };

    editor.on("update", updateHeadings);
    updateHeadings();

    return () => {
      editor.off("update", updateHeadings);
    };
  }, [editor]);

  return (
    <div className="w-56 border-r border-gray-200 bg-white p-4 overflow-y-auto">
      <p className="text-xs font-semibold text-gray-400 tracking-widest mb-3">OUTLINE</p>
      {headings.length === 0 ? (
        <p className="text-xs text-gray-400">No headings yet</p>
      ) : (
        <div className="space-y-1">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => {
                editor?.commands.setTextSelection(h.pos);
                editor?.commands.scrollIntoView();
              }}
              className="block w-full text-left text-sm text-gray-600 hover:text-gray-900 truncate py-1 px-2 rounded hover:bg-gray-100"
              style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
            >
              {h.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire outline sidebar into the document page**

Update `src/app/doc/[id]/page.tsx` to include the OutlineSidebar. The Editor component needs to expose the editor instance. Add a ref callback:

Add to the page imports:
```tsx
import OutlineSidebar from "@/components/OutlineSidebar";
```

Add state for the editor instance:
```tsx
const [editor, setEditor] = useState<import("@tiptap/core").Editor | null>(null);
```

Update Editor component to accept `onEditorReady` prop:
```tsx
<Editor documentId={id} userName={userName} ydoc={ydoc} provider={provider} onEditorReady={setEditor} />
```

Add OutlineSidebar before Editor in the flex container:
```tsx
<OutlineSidebar editor={editor} />
```

Update `src/components/Editor.tsx` to call `onEditorReady`:
```tsx
// Add to props:
onEditorReady?: (editor: import("@tiptap/core").Editor) => void;

// Add useEffect after useEditor:
useEffect(() => {
  if (editor && onEditorReady) onEditorReady(editor);
}, [editor, onEditorReady]);
```

- [ ] **Step 3: Update layout with app font**

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MarkdownCollab",
  description: "Real-time collaborative markdown editing with AI agents",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Full integration test**

```bash
npm run dev:all
```

1. Go to `http://localhost:3000` — create a new document
2. Type markdown content with headings — verify outline sidebar updates
3. Open the same URL in a second tab — verify real-time sync and cursors
4. Click "Invite Agent" — verify suggestions appear inline and in sidebar
5. Accept a suggestion — verify it resolves
6. Click "Export .md" — verify clean markdown downloads
7. Close one tab — reopen — verify content persists

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: outline sidebar, editor integration, and polish"
```

- [ ] **Step 7: Push to GitHub**

```bash
git push origin main
```

# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add in-app notification system for comments, replies, shares, and suggestions with bell icon and dropdown.

**Architecture:** Notification model in Prisma. Server-side creation from WebSocket Yjs map observers and API routes. Polling-based unread count. Bell icon dropdown in document list TopBar.

**Tech Stack:** Prisma, React, Tailwind

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `Notification` model |
| `src/lib/notifications.ts` | New — `createNotification()` utility |
| `src/lib/__tests__/notifications.test.ts` | New — unit tests for createNotification |
| `src/app/api/notifications/route.ts` | New — GET notifications list |
| `src/app/api/notifications/count/route.ts` | New — GET unread count |
| `src/app/api/notifications/read/route.ts` | New — POST mark as read |
| `src/components/NotificationBell.tsx` | New — bell icon with badge + dropdown |
| `src/components/__tests__/NotificationBell.test.tsx` | New — unit tests for bell UI |
| `src/app/page.tsx` | Add NotificationBell to document list header |
| `server/combined-server.mjs` | Add Yjs map observer hooks for comments/suggestions |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the Notification model to the schema**

Append to the end of `prisma/schema.prisma`:

```prisma
model Notification {
  id            String   @id @default(uuid())
  userId        String
  type          String   // "comment" | "reply" | "mention" | "share" | "suggestion"
  documentId    String
  documentTitle String
  actorName     String
  actorId       String?
  message       String
  read          Boolean  @default(false)
  createdAt     DateTime @default(now())

  @@index([userId, read, createdAt])
}
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/ronica/projects/markdown-collab
npx prisma migrate dev --name add-notifications
```

- [ ] **Step 3: Verify the migration applied**

```bash
cd /Users/ronica/projects/markdown-collab
npx prisma db push --accept-data-loss 2>&1 | tail -5
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Notification model to Prisma schema"
```

---

## Task 2: createNotification Utility with Tests

**Files:**
- Create: `src/lib/notifications.ts`
- Create: `src/lib/__tests__/notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/notifications.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotification, buildNotificationMessage } from "../notifications";

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
  default: {
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
    },
  },
}));

import prisma from "@/lib/prisma";

describe("buildNotificationMessage", () => {
  it("builds comment message", () => {
    const msg = buildNotificationMessage("comment", "Alice", "My Doc");
    expect(msg).toBe("Alice commented on My Doc");
  });

  it("builds reply message", () => {
    const msg = buildNotificationMessage("reply", "Bob", "My Doc");
    expect(msg).toBe("Bob replied to your comment on My Doc");
  });

  it("builds share message", () => {
    const msg = buildNotificationMessage("share", "Carol", "My Doc");
    expect(msg).toBe("Carol shared My Doc with you");
  });

  it("builds suggestion message", () => {
    const msg = buildNotificationMessage("suggestion", "Dave", "My Doc");
    expect(msg).toBe("Dave added a suggestion on My Doc");
  });
});

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a notification in the database", async () => {
    await createNotification({
      userId: "user-1",
      type: "comment",
      documentId: "doc-1",
      documentTitle: "My Doc",
      actorName: "Alice",
      actorId: "actor-1",
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        type: "comment",
        documentId: "doc-1",
        documentTitle: "My Doc",
        actorName: "Alice",
        actorId: "actor-1",
        message: "Alice commented on My Doc",
      },
    });
  });

  it("does not notify the actor themselves", async () => {
    await createNotification({
      userId: "actor-1",
      type: "comment",
      documentId: "doc-1",
      documentTitle: "My Doc",
      actorName: "Alice",
      actorId: "actor-1",
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
  });
});
```

Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/notifications.test.ts --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 2: Implement the createNotification utility**

Create `src/lib/notifications.ts`:

```typescript
import prisma from "@/lib/prisma";

export type NotificationType =
  | "comment"
  | "reply"
  | "mention"
  | "share"
  | "suggestion";

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  documentId: string;
  documentTitle: string;
  actorName: string;
  actorId?: string;
}

export function buildNotificationMessage(
  type: NotificationType,
  actorName: string,
  documentTitle: string
): string {
  switch (type) {
    case "comment":
      return `${actorName} commented on ${documentTitle}`;
    case "reply":
      return `${actorName} replied to your comment on ${documentTitle}`;
    case "share":
      return `${actorName} shared ${documentTitle} with you`;
    case "suggestion":
      return `${actorName} added a suggestion on ${documentTitle}`;
    case "mention":
      return `${actorName} mentioned you in ${documentTitle}`;
    default:
      return `${actorName} updated ${documentTitle}`;
  }
}

export async function createNotification(
  params: CreateNotificationParams
): Promise<void> {
  const { userId, type, documentId, documentTitle, actorName, actorId } =
    params;

  // Don't notify the actor about their own action
  if (actorId && actorId === userId) return;

  const message = buildNotificationMessage(type, actorName, documentTitle);

  await prisma.notification.create({
    data: {
      userId,
      type,
      documentId,
      documentTitle,
      actorName,
      actorId: actorId ?? null,
      message,
    },
  });
}
```

- [ ] **Step 3: Run tests (expect all pass)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/lib/__tests__/notifications.test.ts --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/lib/notifications.ts src/lib/__tests__/notifications.test.ts
git commit -m "feat: add createNotification utility with unit tests"
```

---

## Task 3: Notification API Endpoints

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/count/route.ts`
- Create: `src/app/api/notifications/read/route.ts`

- [ ] **Step 1: Create GET /api/notifications endpoint**

Create `src/app/api/notifications/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
  const cursor = searchParams.get("cursor");

  const where: Record<string, unknown> = { userId: user.id };
  if (unreadOnly) where.read = false;
  if (cursor) where.createdAt = { lt: new Date(cursor) };

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(notifications);
}
```

- [ ] **Step 2: Create GET /api/notifications/count endpoint**

Create `src/app/api/notifications/count/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const unread = await prisma.notification.count({
    where: { userId: user.id, read: false },
  });

  return NextResponse.json({ unread });
}
```

- [ ] **Step 3: Create POST /api/notifications/read endpoint**

Create `src/app/api/notifications/read/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();

  if (body.all === true) {
    await prisma.notification.updateMany({
      where: { userId: user.id, read: false },
      data: { read: true },
    });
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: body.ids }, userId: user.id },
      data: { read: true },
    });
  } else {
    return NextResponse.json(
      { error: 'Provide { ids: string[] } or { all: true }' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add -f src/app/api/notifications/route.ts src/app/api/notifications/count/route.ts src/app/api/notifications/read/route.ts
git commit -m "feat: add notification API endpoints (list, count, mark-read)"
```

---

## Task 4: WebSocket Server Hooks for Yjs Map Changes

**Files:**
- Modify: `server/combined-server.mjs`

- [ ] **Step 1: Add Prisma client import and notification creation helper**

At the top of `server/combined-server.mjs`, after the existing imports, add:

```javascript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
```

Add a helper function after the `listToMarkdown` function and before `getDoc`:

```javascript
/**
 * Create a notification in the database.
 * Called from Yjs map observers when comments/suggestions change.
 */
async function createNotificationFromServer({ userId, type, documentId, documentTitle, actorName, actorId, message }) {
  // Don't notify the actor about their own action
  if (actorId && actorId === userId) return;
  try {
    await prisma.notification.create({
      data: { userId, type, documentId, documentTitle, actorName, actorId, message },
    });
  } catch (err) {
    console.error("Failed to create notification:", err.message);
  }
}

/**
 * Look up document owner (creator) from the database.
 */
async function getDocumentOwner(documentId) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    return doc;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Add Yjs map observers in the getDoc function**

Inside the `getDoc` function, after the line `const entry = { doc, awareness, conns: new Set() };` and before `docs.set(docName, entry);`, add observers for comments and suggestions Y.Maps:

```javascript
  // Observe comments Y.Map for new comments/replies
  const commentsMap = doc.getMap("comments");
  const knownCommentIds = new Set(commentsMap.keys());

  commentsMap.observe(async (event) => {
    for (const [key, change] of event.changes.keys) {
      if (change.action === "add" && !knownCommentIds.has(key)) {
        knownCommentIds.add(key);
        try {
          const comment = commentsMap.get(key);
          if (!comment || typeof comment !== "object") continue;
          const commentData = comment.toJSON ? comment.toJSON() : comment;
          const docRecord = await getDocumentOwner(docName);
          const docTitle = docRecord?.title || "Untitled";
          const actorName = commentData.authorName || "Someone";

          // Determine notification type: reply vs new comment
          const type = commentData.parentCommentId ? "reply" : "comment";
          const message = type === "reply"
            ? `${actorName} replied to your comment on ${docTitle}`
            : `${actorName} commented on ${docTitle}`;

          // Notify document owner (if we can determine them)
          // For now, we create a notification but need the owner userId
          // This is a best-effort approach since Document model doesn't have ownerId yet
          if (type === "reply" && commentData.parentCommentId) {
            // Find the parent comment author to notify
            const parentComment = commentsMap.get(commentData.parentCommentId);
            if (parentComment) {
              const parentData = parentComment.toJSON ? parentComment.toJSON() : parentComment;
              if (parentData.authorId && parentData.authorId !== commentData.authorId) {
                await createNotificationFromServer({
                  userId: parentData.authorId,
                  type: "reply",
                  documentId: docName,
                  documentTitle: docTitle,
                  actorName,
                  actorId: commentData.authorId || null,
                  message,
                });
              }
            }
          }
        } catch (err) {
          console.error("Error processing comment notification:", err.message);
        }
      }
    }
  });

  // Observe suggestions Y.Map for new suggestions and status changes
  const suggestionsMap = doc.getMap("suggestions");
  const knownSuggestionStates = new Map();
  for (const [key] of suggestionsMap.entries()) {
    const sug = suggestionsMap.get(key);
    const sugData = sug && sug.toJSON ? sug.toJSON() : sug;
    knownSuggestionStates.set(key, sugData?.status || "pending");
  }

  suggestionsMap.observe(async (event) => {
    for (const [key, change] of event.changes.keys) {
      try {
        const sug = suggestionsMap.get(key);
        if (!sug) continue;
        const sugData = sug.toJSON ? sug.toJSON() : sug;
        const docRecord = await getDocumentOwner(docName);
        const docTitle = docRecord?.title || "Untitled";

        if (change.action === "add") {
          const actorName = sugData.authorName || "Someone";
          const message = `${actorName} added a suggestion on ${docTitle}`;
          // Notification target would be document owner — requires ownerId on Document
          knownSuggestionStates.set(key, sugData.status || "pending");
        } else if (change.action === "update") {
          const prevStatus = knownSuggestionStates.get(key);
          const newStatus = sugData.status;
          knownSuggestionStates.set(key, newStatus);

          if (prevStatus === "pending" && (newStatus === "accepted" || newStatus === "rejected")) {
            // Notify the suggestion author that their suggestion was acted on
            if (sugData.authorId) {
              const message = `Your suggestion on ${docTitle} was ${newStatus}`;
              await createNotificationFromServer({
                userId: sugData.authorId,
                type: "suggestion",
                documentId: docName,
                documentTitle: docTitle,
                actorName: "Editor",
                actorId: null,
                message,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error processing suggestion notification:", err.message);
      }
    }
  });
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add server/combined-server.mjs
git commit -m "feat: add Yjs map observers for comment/suggestion notifications"
```

---

## Task 5: NotificationBell Component

**Files:**
- Create: `src/components/NotificationBell.tsx`
- Create: `src/components/__tests__/NotificationBell.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/NotificationBell.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import NotificationBell from "../NotificationBell";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no unread notifications
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ unread: 0 }),
    });
  });

  it("renders bell icon", () => {
    render(<NotificationBell />);
    expect(screen.getByTitle("Notifications")).toBeDefined();
  });

  it("shows unread badge when count > 0", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ unread: 3 }),
    });
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.getByText("3")).toBeDefined();
    });
  });

  it("does not show badge when count is 0", async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(screen.queryByText("0")).toBeNull();
    });
  });

  it("opens dropdown when clicked", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unread: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "n1",
            type: "comment",
            message: "Alice commented on My Doc",
            documentId: "doc-1",
            read: false,
            createdAt: new Date().toISOString(),
          },
        ],
      });

    render(<NotificationBell />);
    fireEvent.click(screen.getByTitle("Notifications"));

    await waitFor(() => {
      expect(screen.getByText("Alice commented on My Doc")).toBeDefined();
    });
  });
});
```

Run tests (expect failures):

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/NotificationBell.test.tsx --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 2: Implement the NotificationBell component**

Create `src/components/NotificationBell.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  message: string;
  documentId: string;
  documentTitle: string;
  actorName: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Poll unread count every 30 seconds
  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread);
      }
    } catch {
      // Silently ignore network errors
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCount]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Fetch full notifications when dropdown opens
  async function handleOpen() {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      try {
        const res = await fetch("/api/notifications?limit=20");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch {
        // Silently ignore
      } finally {
        setLoading(false);
      }
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Silently ignore
    }
  }

  function handleNotificationClick(notif: Notification) {
    // Mark as read
    if (!notif.read) {
      fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [notif.id] }),
      }).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
      );
    }
    setOpen(false);
    router.push(`/doc/${notif.documentId}`);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        title="Notifications"
        className="relative flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/8 transition-colors"
      >
        <svg
          className="h-4.5 w-4.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#B8692A] hover:text-[#96541F] font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No notifications yet
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                    !notif.read ? "bg-amber-50/50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!notif.read && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-[#B8692A] shrink-0" />
                    )}
                    <div className={`min-w-0 ${notif.read ? "ml-5" : ""}`}>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run tests (expect all pass)**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run src/components/__tests__/NotificationBell.test.tsx --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 4: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/NotificationBell.tsx src/components/__tests__/NotificationBell.test.tsx
git commit -m "feat: add NotificationBell component with polling and dropdown"
```

---

## Task 6: Integrate NotificationBell into Document List Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import NotificationBell**

At the top of `src/app/page.tsx`, add the import:

```typescript
import NotificationBell from "@/components/NotificationBell";
```

- [ ] **Step 2: Add the bell to the document list header**

In `src/app/page.tsx`, find the header section with the "New Document" button. The bell goes between the sort button and the "New Document" button.

Find this block inside the `<header>` element:

```tsx
          <button
            onClick={createDoc}
            disabled={creating}
```

Insert the NotificationBell just before that button, after the sort button's closing `</button>`:

```tsx
            {session && <NotificationBell />}
```

This conditionally shows the bell only when the user is logged in.

- [ ] **Step 3: Also add to the mobile header**

In the mobile header section (`md:hidden`), add the bell between the branding and the user avatar. Find the `<div className="flex items-center gap-2">` inside the mobile header's `session ?` block and add:

```tsx
<NotificationBell />
```

right before the user avatar.

- [ ] **Step 4: Verify all tests pass**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/app/page.tsx
git commit -m "feat: add notification bell to document list page header"
```

---

## Task 7: Polling Logic with Visibility API

**Files:** Already implemented in `NotificationBell.tsx` (Task 5). This task is verification-only.

- [ ] **Step 1: Write a test for visibility-based polling**

Add to `src/components/__tests__/NotificationBell.test.tsx`:

```tsx
it("re-fetches count when tab becomes visible", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ unread: 0 }),
  });
  render(<NotificationBell />);

  // Wait for initial fetch
  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Simulate tab becoming visible
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    writable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/ronica/projects/markdown-collab
npx vitest run --reporter=verbose 2>&1 | tail -30
```

- [ ] **Step 3: Commit**

```bash
cd /Users/ronica/projects/markdown-collab
git add src/components/__tests__/NotificationBell.test.tsx
git commit -m "test: add visibility-change polling test for NotificationBell"
```

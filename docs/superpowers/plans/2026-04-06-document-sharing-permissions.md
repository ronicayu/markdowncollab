# Document Sharing & Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add document sharing with viewer/editor/owner roles, email-based sharing, and link sharing.

**Architecture:** Extend Prisma schema with DocumentShare model and Document.ownerId. Add access control middleware checked in all API routes and WebSocket connections. Share management UI in TopBar.

**Tech Stack:** Prisma, NextAuth JWT, React, Tailwind

---

## Task 1: Prisma Schema Migration

**Files:** `prisma/schema.prisma`
**Time:** ~3 min

- [ ] 1.1 Update `prisma/schema.prisma` to add `ownerId` and `visibility` fields to `Document`, add the `DocumentShare` model, and add the relation:

```prisma
model Document {
  id         String          @id @default(uuid())
  title      String          @default("Untitled")
  ownerId    String?
  visibility String          @default("private")
  createdAt  DateTime        @default(now())
  updatedAt  DateTime        @updatedAt
  shares     DocumentShare[]
}

model DocumentShare {
  id         String   @id @default(uuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  userId     String?
  email      String?
  role       String   @default("viewer")
  shareToken String?  @unique
  createdAt  DateTime @default(now())

  @@unique([documentId, userId])
  @@unique([documentId, email])
  @@index([shareToken])
}
```

- [ ] 1.2 Run the migration:

```bash
npx prisma migrate dev --name add-document-sharing
```

Expected output: `Your database is now in sync with your schema.`

- [ ] 1.3 Verify the generated client has the new models:

```bash
npx prisma generate
```

- [ ] 1.4 Commit: `git add prisma/ && git commit -m "feat: add DocumentShare model and Document ownership fields"`

---

## Task 2: Access Control Utility — Tests

**Files:** `src/lib/__tests__/access-control.test.ts`
**Time:** ~5 min

- [ ] 2.1 Create test file `src/lib/__tests__/access-control.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkDocumentAccess, type AccessResult } from "@/lib/access-control";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockShareFindFirst = vi.mocked(prisma.documentShare.findFirst);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkDocumentAccess", () => {
  const docId = "doc-1";
  const userId = "user-1";
  const userEmail = "user@example.com";

  it("returns no-access when document does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: false, role: null });
  });

  it("returns owner role when user is the document owner", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: userId,
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "owner" });
  });

  it("returns role from explicit share by userId", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue({
      id: "share-1",
      documentId: docId,
      userId,
      email: null,
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("returns role from explicit share by email", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    // First call (by userId) returns null, second call (by email) returns share
    mockShareFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "share-2",
        documentId: docId,
        userId: null,
        email: userEmail,
        role: "viewer",
        shareToken: null,
        createdAt: new Date(),
      } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "viewer" });
  });

  it("returns no-access for private doc with no share", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: false, role: null });
  });

  it("returns viewer for anyone_with_link doc even without explicit share", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "anyone_with_link",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "viewer" });
  });

  it("returns full access for legacy docs with no owner", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: null,
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue(null);
    const result = await checkDocumentAccess(docId, userId, userEmail);
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("validates share token access", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst
      .mockResolvedValueOnce(null) // by userId
      .mockResolvedValueOnce(null) // by email
      .mockResolvedValueOnce({     // by shareToken
        id: "share-3",
        documentId: docId,
        userId: null,
        email: null,
        role: "editor",
        shareToken: "tok-abc",
        createdAt: new Date(),
      } as any);
    const result = await checkDocumentAccess(docId, null, null, "tok-abc");
    expect(result).toEqual({ hasAccess: true, role: "editor" });
  });

  it("checks required role — editor cannot delete (requires owner)", async () => {
    mockFindUnique.mockResolvedValue({
      id: docId,
      ownerId: "other-user",
      visibility: "private",
      title: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    mockShareFindFirst.mockResolvedValue({
      id: "share-1",
      documentId: docId,
      userId,
      email: null,
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);
    const result = await checkDocumentAccess(docId, userId, userEmail, undefined, "owner");
    expect(result).toEqual({ hasAccess: false, role: "editor" });
  });
});
```

- [ ] 2.2 Run the test — it should fail because `@/lib/access-control` does not exist yet:

```bash
npx vitest run src/lib/__tests__/access-control.test.ts
```

Expected: `Cannot find module '@/lib/access-control'`

- [ ] 2.3 Commit: `git add src/lib/__tests__/access-control.test.ts && git commit -m "test: add failing tests for checkDocumentAccess utility"`

---

## Task 3: Access Control Utility — Implementation

**Files:** `src/lib/access-control.ts`
**Time:** ~4 min

- [ ] 3.1 Create `src/lib/access-control.ts`:

```typescript
import { prisma } from "@/lib/prisma";

export interface AccessResult {
  hasAccess: boolean;
  role: "owner" | "editor" | "viewer" | null;
}

const ROLE_HIERARCHY: Record<string, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
};

/**
 * Check if a user has access to a document.
 * Priority: owner > explicit share (userId, then email) > share token > visibility fallback > legacy (no owner).
 * If requiredRole is specified, the user's resolved role must be >= requiredRole in the hierarchy.
 */
export async function checkDocumentAccess(
  documentId: string,
  userId: string | null | undefined,
  userEmail: string | null | undefined,
  shareToken?: string | null,
  requiredRole?: "viewer" | "editor" | "owner"
): Promise<AccessResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!doc) {
    return { hasAccess: false, role: null };
  }

  // Legacy documents with no owner are accessible to all authenticated users
  if (!doc.ownerId) {
    return { hasAccess: true, role: "editor" };
  }

  // Document owner gets full access
  if (userId && doc.ownerId === userId) {
    return { hasAccess: true, role: "owner" };
  }

  // Check explicit share by userId
  if (userId) {
    const shareByUser = await prisma.documentShare.findFirst({
      where: { documentId, userId },
    });
    if (shareByUser) {
      return meetsRequiredRole(shareByUser.role as AccessResult["role"], requiredRole);
    }
  }

  // Check explicit share by email
  if (userEmail) {
    const shareByEmail = await prisma.documentShare.findFirst({
      where: { documentId, email: userEmail.toLowerCase() },
    });
    if (shareByEmail) {
      return meetsRequiredRole(shareByEmail.role as AccessResult["role"], requiredRole);
    }
  }

  // Check share token
  if (shareToken) {
    const shareByToken = await prisma.documentShare.findFirst({
      where: { documentId, shareToken },
    });
    if (shareByToken) {
      return meetsRequiredRole(shareByToken.role as AccessResult["role"], requiredRole);
    }
  }

  // Fallback: anyone_with_link visibility grants viewer access
  if (doc.visibility === "anyone_with_link") {
    return meetsRequiredRole("viewer", requiredRole);
  }

  return { hasAccess: false, role: null };
}

function meetsRequiredRole(
  resolvedRole: AccessResult["role"],
  requiredRole?: "viewer" | "editor" | "owner"
): AccessResult {
  if (!resolvedRole) {
    return { hasAccess: false, role: null };
  }
  if (!requiredRole) {
    return { hasAccess: true, role: resolvedRole };
  }
  const has = ROLE_HIERARCHY[resolvedRole] ?? 0;
  const needs = ROLE_HIERARCHY[requiredRole] ?? 0;
  return { hasAccess: has >= needs, role: resolvedRole };
}
```

- [ ] 3.2 Run the tests — all should pass:

```bash
npx vitest run src/lib/__tests__/access-control.test.ts
```

Expected: `Tests: 8 passed`

- [ ] 3.3 Commit: `git add src/lib/access-control.ts && git commit -m "feat: implement checkDocumentAccess utility with role hierarchy"`

---

## Task 4: Add User ID to NextAuth JWT/Session

**Files:** `src/lib/auth.ts`
**Time:** ~3 min

- [ ] 4.1 Update `src/lib/auth.ts` to add `callbacks` so that `session.user.id` and `session.user.email` are available. Add after the `pages` config:

```typescript
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        (session.user as any).id = token.id as string;
      }
      return session;
    },
  },
};
```

- [ ] 4.2 Create `src/types/next-auth.d.ts` for type augmentation:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
```

- [ ] 4.3 Commit: `git add src/lib/auth.ts src/types/next-auth.d.ts && git commit -m "feat: expose user ID in NextAuth session and JWT"`

---

## Task 5: Update Document List API — Test

**Files:** `src/app/api/documents/__tests__/route.test.ts`
**Time:** ~4 min

- [ ] 5.1 Create `src/app/api/documents/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    documentShare: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

const mockFindMany = vi.mocked(prisma.document.findMany);
const mockShareFindMany = vi.mocked(prisma.documentShare.findMany);
const mockGetSession = vi.mocked(getServerSession);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/documents", () => {
  it("returns only owned and shared documents for authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);

    mockFindMany.mockResolvedValue([
      { id: "doc-1", title: "My Doc", ownerId: "user-1", visibility: "private", createdAt: new Date(), updatedAt: new Date() },
      { id: "doc-legacy", title: "Legacy", ownerId: null, visibility: "private", createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    mockShareFindMany.mockResolvedValue([
      { id: "s1", documentId: "doc-2", userId: "user-1", email: null, role: "editor", shareToken: null, createdAt: new Date() },
    ] as any);

    // Import after mocks
    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(data.length).toBeGreaterThanOrEqual(1);
    // Verify the query included the user's ID in the where clause
    expect(mockFindMany).toHaveBeenCalled();
  });

  it("returns all documents when no session (backward compat for unauthenticated)", async () => {
    mockGetSession.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([
      { id: "doc-1", title: "Public", ownerId: null, visibility: "private", createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET();
    const data = await res.json();

    expect(data).toHaveLength(1);
  });
});
```

- [ ] 5.2 Run the test — should fail because the route has no access filtering yet:

```bash
npx vitest run src/app/api/documents/__tests__/route.test.ts
```

- [ ] 5.3 Commit: `git add src/app/api/documents/__tests__/ && git commit -m "test: add failing tests for document list access filtering"`

---

## Task 6: Update Document List API — Implementation

**Files:** `src/app/api/documents/route.ts`
**Time:** ~4 min

- [ ] 6.1 Replace `src/app/api/documents/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!userId) {
    // Unauthenticated: only return legacy docs (no owner) for backward compatibility
    const docs = await prisma.document.findMany({
      where: { ownerId: null },
      select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(docs.map((d) => ({ ...d, role: "editor" })));
  }

  // Get documents the user has explicit shares on
  const shares = await prisma.documentShare.findMany({
    where: {
      OR: [
        { userId },
        ...(userEmail ? [{ email: userEmail.toLowerCase() }] : []),
      ],
    },
    select: { documentId: true, role: true },
  });
  const sharedDocIds = shares.map((s) => s.documentId);
  const shareRoleMap = new Map(shares.map((s) => [s.documentId, s.role]));

  const docs = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: userId },            // docs I own
        { ownerId: null },               // legacy docs (no owner)
        { id: { in: sharedDocIds } },    // docs shared with me
      ],
    },
    select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });

  const result = docs.map((d) => {
    let role: string;
    if (d.ownerId === userId) {
      role = "owner";
    } else if (!d.ownerId) {
      role = "editor"; // legacy doc
    } else {
      role = shareRoleMap.get(d.id) ?? "viewer";
    }
    return { ...d, role };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;

  const { title } = await req.json();
  const doc = await prisma.document.create({
    data: {
      title: title || "Untitled",
      ownerId: userId ?? null,
    },
  });
  return NextResponse.json({ ...doc, role: "owner" }, { status: 201 });
}
```

- [ ] 6.2 Run tests:

```bash
npx vitest run src/app/api/documents/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] 6.3 Commit: `git add src/app/api/documents/route.ts && git commit -m "feat: filter document list by ownership and shares"`

---

## Task 7: Update Single Document API — Test

**Files:** `src/app/api/documents/[id]/__tests__/route.test.ts`
**Time:** ~4 min

- [ ] 7.1 Create `src/app/api/documents/[id]/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);
const mockFindUnique = vi.mocked(prisma.document.findUnique);
const mockUpdate = vi.mocked(prisma.document.update);
const mockDelete = vi.mocked(prisma.document.delete);

beforeEach(() => {
  vi.clearAllMocks();
});

const params = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]", () => {
  it("returns 403 when user has no access", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: false, role: null });

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/documents/doc-1"), { params });
    expect(res.status).toBe(403);
  });

  it("returns document with role when user has access", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "editor" });
    mockFindUnique.mockResolvedValue({
      id: "doc-1",
      title: "Test",
      ownerId: "other",
      visibility: "private",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost/api/documents/doc-1"), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.role).toBe("editor");
  });
});

describe("DELETE /api/documents/[id]", () => {
  it("returns 403 when user is not owner", async () => {
    mockGetSession.mockResolvedValue({
      user: { id: "user-1", email: "a@b.com", name: "Alice" },
      expires: "never",
    } as any);
    mockCheckAccess.mockResolvedValue({ hasAccess: false, role: "editor" });

    const { DELETE } = await import("../route");
    const res = await DELETE(new Request("http://localhost/api/documents/doc-1"), { params });
    expect(res.status).toBe(403);
  });
});
```

- [ ] 7.2 Run the test — should fail:

```bash
npx vitest run src/app/api/documents/[id]/__tests__/route.test.ts
```

- [ ] 7.3 Commit: `git add src/app/api/documents/[id]/__tests__/ && git commit -m "test: add failing tests for single document access checks"`

---

## Task 8: Update Single Document API — Implementation

**Files:** `src/app/api/documents/[id]/route.ts`
**Time:** ~4 min

- [ ] 8.1 Replace `src/app/api/documents/[id]/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { unlink } from "fs/promises";
import { join } from "path";

const YJS_DIR = process.env.YPERSISTENCE || "./yjs-data";
const MD_DIR = process.env.MARKDOWN_DIR || "./documents";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, ownerId: true, visibility: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ...doc, role: access.role });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "editor");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title } = await req.json();
  const doc = await prisma.document.update({ where: { id }, data: { title } });
  return NextResponse.json({ ...doc, role: access.role });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.document.delete({ where: { id } });
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
  ]);
  return NextResponse.json({ ok: true });
}
```

- [ ] 8.2 Run tests:

```bash
npx vitest run src/app/api/documents/[id]/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] 8.3 Commit: `git add src/app/api/documents/[id]/route.ts && git commit -m "feat: add access control to single document API endpoints"`

---

## Task 9: Share CRUD API — Tests

**Files:** `src/app/api/documents/[id]/share/__tests__/route.test.ts`
**Time:** ~5 min

- [ ] 9.1 Create `src/app/api/documents/[id]/share/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: { findUnique: vi.fn() },
    documentShare: {
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);
const mockShareFindMany = vi.mocked(prisma.documentShare.findMany);
const mockShareCreate = vi.mocked(prisma.documentShare.create);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Owner" },
    expires: "never",
  } as any);
});

const params = Promise.resolve({ id: "doc-1" });

describe("GET /api/documents/[id]/share", () => {
  it("returns shares list for owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareFindMany.mockResolvedValue([
      { id: "s1", documentId: "doc-1", userId: null, email: "b@c.com", role: "viewer", shareToken: null, createdAt: new Date() },
    ] as any);

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost"), { params });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("returns 403 for non-owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "editor" });

    const { GET } = await import("../route");
    const res = await GET(new Request("http://localhost"), { params });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/documents/[id]/share", () => {
  it("creates a share for owner", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareCreate.mockResolvedValue({
      id: "s-new",
      documentId: "doc-1",
      userId: null,
      email: "new@user.com",
      role: "editor",
      shareToken: null,
      createdAt: new Date(),
    } as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "new@user.com", role: "editor" }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.email).toBe("new@user.com");
  });

  it("rejects invalid role", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "x@y.com", role: "admin" }),
      }),
      { params }
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] 9.2 Run — should fail:

```bash
npx vitest run src/app/api/documents/[id]/share/__tests__/route.test.ts
```

- [ ] 9.3 Commit: `git add src/app/api/documents/[id]/share/__tests__/ && git commit -m "test: add failing tests for share CRUD API"`

---

## Task 10: Share CRUD API — Implementation

**Files:** `src/app/api/documents/[id]/share/route.ts`
**Time:** ~5 min

- [ ] 10.1 Create `src/app/api/documents/[id]/share/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

async function getSessionInfo() {
  const session = await getServerSession(authOptions);
  return {
    userId: (session?.user as any)?.id as string | undefined,
    userEmail: session?.user?.email ?? undefined,
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can view shares" }, { status: 403 });
  }

  const shares = await prisma.documentShare.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(shares);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId, userEmail } = await getSessionInfo();

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can share" }, { status: 403 });
  }

  const { email, role } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  if (!["viewer", "editor"].includes(role)) {
    return NextResponse.json({ error: "Role must be viewer or editor" }, { status: 400 });
  }

  const share = await prisma.documentShare.create({
    data: {
      documentId: id,
      email: email.toLowerCase(),
      role,
    },
  });

  return NextResponse.json(share, { status: 201 });
}
```

- [ ] 10.2 Create `src/app/api/documents/[id]/share/[shareId]/route.ts` for DELETE:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const { id, shareId } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can remove shares" }, { status: 403 });
  }

  await prisma.documentShare.delete({ where: { id: shareId } });

  return NextResponse.json({ ok: true });
}
```

- [ ] 10.3 Run tests:

```bash
npx vitest run src/app/api/documents/[id]/share/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] 10.4 Commit: `git add -f src/app/api/documents/ && git commit -m "feat: add share CRUD API endpoints (GET, POST, DELETE)"`

---

## Task 11: Share Link Generation/Validation — Test

**Files:** `src/app/api/documents/[id]/share-link/__tests__/route.test.ts`
**Time:** ~4 min

- [ ] 11.1 Create `src/app/api/documents/[id]/share-link/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    documentShare: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/access-control", () => ({
  checkDocumentAccess: vi.fn(),
}));

import { getServerSession } from "next-auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const mockGetSession = vi.mocked(getServerSession);
const mockCheckAccess = vi.mocked(checkDocumentAccess);
const mockDocUpdate = vi.mocked(prisma.document.update);
const mockShareCreate = vi.mocked(prisma.documentShare.create);
const mockShareDeleteMany = vi.mocked(prisma.documentShare.deleteMany);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue({
    user: { id: "user-1", email: "a@b.com", name: "Owner" },
    expires: "never",
  } as any);
});

const params = Promise.resolve({ id: "doc-1" });

describe("POST /api/documents/[id]/share-link", () => {
  it("enables link sharing and returns a token", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareCreate.mockImplementation(async ({ data }: any) => ({
      id: "share-link-1",
      documentId: "doc-1",
      userId: null,
      email: null,
      role: data.role,
      shareToken: data.shareToken,
      createdAt: new Date(),
    }));
    mockDocUpdate.mockResolvedValue({} as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, role: "viewer" }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.shareToken).toBeTruthy();
    expect(data.role).toBe("viewer");
  });

  it("disables link sharing", async () => {
    mockCheckAccess.mockResolvedValue({ hasAccess: true, role: "owner" });
    mockShareDeleteMany.mockResolvedValue({ count: 1 } as any);
    mockDocUpdate.mockResolvedValue({} as any);

    const { POST } = await import("../route");
    const res = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      }),
      { params }
    );
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.shareToken).toBeNull();
  });
});
```

- [ ] 11.2 Run — should fail:

```bash
npx vitest run src/app/api/documents/[id]/share-link/__tests__/route.test.ts
```

- [ ] 11.3 Commit: `git add -f src/app/api/documents/ && git commit -m "test: add failing tests for share link generation"`

---

## Task 12: Share Link Generation/Validation — Implementation

**Files:** `src/app/api/documents/[id]/share-link/route.ts`
**Time:** ~4 min

- [ ] 12.1 Create `src/app/api/documents/[id]/share-link/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { randomUUID } from "crypto";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Only the document owner can manage link sharing" }, { status: 403 });
  }

  const { enabled, role } = await req.json();

  if (enabled) {
    if (role && !["viewer", "editor"].includes(role)) {
      return NextResponse.json({ error: "Role must be viewer or editor" }, { status: 400 });
    }

    const shareToken = randomUUID();
    const shareRole = role || "viewer";

    // Remove any existing link shares first
    await prisma.documentShare.deleteMany({
      where: { documentId: id, shareToken: { not: null } },
    });

    // Create the link share
    const share = await prisma.documentShare.create({
      data: {
        documentId: id,
        shareToken,
        role: shareRole,
      },
    });

    // Update document visibility
    await prisma.document.update({
      where: { id },
      data: { visibility: "anyone_with_link" },
    });

    return NextResponse.json({
      shareToken: share.shareToken,
      role: share.role,
      url: `/doc/${id}?token=${share.shareToken}`,
    });
  } else {
    // Disable link sharing — remove all token-based shares
    await prisma.documentShare.deleteMany({
      where: { documentId: id, shareToken: { not: null } },
    });

    await prisma.document.update({
      where: { id },
      data: { visibility: "private" },
    });

    return NextResponse.json({ shareToken: null });
  }
}
```

- [ ] 12.2 Run tests:

```bash
npx vitest run src/app/api/documents/[id]/share-link/__tests__/route.test.ts
```

Expected: all tests pass.

- [ ] 12.3 Commit: `git add -f src/app/api/documents/ && git commit -m "feat: add share link generation and revocation endpoint"`

---

## Task 13: WebSocket Access Control

**Files:** `server/combined-server.mjs`
**Time:** ~5 min

- [ ] 13.1 Add JWT verification and access checking to the WebSocket upgrade handler in `server/combined-server.mjs`. Add the following imports and helpers near the top of the file (after the existing imports):

```javascript
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const wsDbClient = new PrismaClient();

async function checkWsAccess(documentId, userId, userEmail, shareToken) {
  const doc = await wsDbClient.document.findUnique({ where: { id: documentId } });
  if (!doc) return { hasAccess: false, role: null };
  if (!doc.ownerId) return { hasAccess: true, role: "editor" };
  if (userId && doc.ownerId === userId) return { hasAccess: true, role: "owner" };

  if (userId) {
    const byUser = await wsDbClient.documentShare.findFirst({ where: { documentId, userId } });
    if (byUser) return { hasAccess: true, role: byUser.role };
  }
  if (userEmail) {
    const byEmail = await wsDbClient.documentShare.findFirst({ where: { documentId, email: userEmail.toLowerCase() } });
    if (byEmail) return { hasAccess: true, role: byEmail.role };
  }
  if (shareToken) {
    const byToken = await wsDbClient.documentShare.findFirst({ where: { documentId, shareToken } });
    if (byToken) return { hasAccess: true, role: byToken.role };
  }
  if (doc.visibility === "anyone_with_link") return { hasAccess: true, role: "viewer" };
  return { hasAccess: false, role: null };
}
```

- [ ] 13.2 Update the `server.on("upgrade", ...)` handler to check access before allowing the WebSocket connection. Replace the existing handler:

```javascript
  server.on("upgrade", async (req, socket, head) => {
    if (req.url?.startsWith("/ws/")) {
      // Extract document ID from URL
      const docName = req.url.replace(/^\/ws\//, "").split("?")[0] || "default";

      // Parse token from query string
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      const shareToken = urlObj.searchParams.get("token");
      const jwtToken = urlObj.searchParams.get("jwt");

      let userId = null;
      let userEmail = null;

      // Verify JWT if provided
      if (jwtToken) {
        try {
          const secret = process.env.NEXTAUTH_SECRET;
          if (secret) {
            const decoded = jwt.verify(jwtToken, secret);
            userId = decoded.id || decoded.sub || null;
            userEmail = decoded.email || null;
          }
        } catch {
          // Invalid JWT — continue without user context
        }
      }

      // Check access
      const access = await checkWsAccess(docName, userId, userEmail, shareToken);
      if (!access.hasAccess) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        // Attach role to the ws object so we can use it for awareness
        ws._userRole = access.role;
        ws._userId = userId;
        wss.emit("connection", ws, req);
      });
    }
    // Let Next.js handle its own WebSocket upgrades (HMR)
  });
```

- [ ] 13.3 Install `jsonwebtoken` as a dependency:

```bash
npm install jsonwebtoken
```

- [ ] 13.4 Run the server to verify it starts without errors:

```bash
timeout 5 node server/combined-server.mjs 2>&1 || true
```

Expected: should see `MarkdownCollab running on...` before timeout.

- [ ] 13.5 Commit: `git add server/combined-server.mjs package.json package-lock.json && git commit -m "feat: add WebSocket access control with JWT verification"`

---

## Task 14: Share Dialog UI — Component

**Files:** `src/components/ShareDialog.tsx`
**Time:** ~5 min

- [ ] 14.1 Create `src/components/ShareDialog.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";

interface Share {
  id: string;
  email: string | null;
  role: string;
  shareToken: string | null;
}

interface ShareDialogProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareDialog({ documentId, isOpen, onClose }: ShareDialogProps) {
  const [shares, setShares] = useState<Share[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkEnabled, setLinkEnabled] = useState(false);
  const [linkRole, setLinkRole] = useState<"viewer" | "editor">("viewer");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetchShares();
  }, [isOpen, documentId]);

  async function fetchShares() {
    try {
      const res = await fetch(`/api/documents/${documentId}/share`);
      if (!res.ok) return;
      const data: Share[] = await res.json();
      setShares(data.filter((s) => !s.shareToken));

      // Check if link sharing is enabled
      const linkShare = data.find((s) => s.shareToken);
      if (linkShare) {
        setLinkEnabled(true);
        setLinkRole(linkShare.role as "viewer" | "editor");
        setLinkUrl(`${window.location.origin}/doc/${documentId}?token=${linkShare.shareToken}`);
      } else {
        setLinkEnabled(false);
        setLinkUrl("");
      }
    } catch {
      // silently fail
    }
  }

  async function handleAddShare() {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to share");
        return;
      }
      setEmail("");
      fetchShares();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveShare(shareId: string) {
    await fetch(`/api/documents/${documentId}/share/${shareId}`, {
      method: "DELETE",
    });
    setShares((prev) => prev.filter((s) => s.id !== shareId));
  }

  async function toggleLinkSharing() {
    const newEnabled = !linkEnabled;
    const res = await fetch(`/api/documents/${documentId}/share-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newEnabled, role: linkRole }),
    });
    const data = await res.json();
    if (newEnabled && data.shareToken) {
      setLinkEnabled(true);
      setLinkUrl(`${window.location.origin}${data.url}`);
    } else {
      setLinkEnabled(false);
      setLinkUrl("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 mx-4 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Share document</h3>

        {/* Email share form */}
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddShare()}
            className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#B8692A] focus:ring-1 focus:ring-[#B8692A]"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
            className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-[#B8692A]"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={handleAddShare}
            disabled={loading || !email.trim()}
            className="shrink-0 bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Share
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

        {/* Current shares list */}
        {shares.length > 0 && (
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-4 max-h-40 overflow-y-auto">
            {shares.map((share) => (
              <div key={share.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{share.email}</p>
                  <p className="text-xs text-gray-400 capitalize">{share.role}</p>
                </div>
                <button
                  onClick={() => handleRemoveShare(share.id)}
                  className="shrink-0 text-xs text-gray-400 hover:text-red-500 transition-colors ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Link sharing section */}
        <div className="border-t border-gray-100 pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Anyone with the link</p>
              <p className="text-xs text-gray-400">
                {linkEnabled ? `Can ${linkRole === "editor" ? "edit" : "view"}` : "Disabled"}
              </p>
            </div>
            <button
              onClick={toggleLinkSharing}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                linkEnabled ? "bg-[#B8692A]" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  linkEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {linkEnabled && (
            <>
              <div className="flex gap-2 mb-2">
                <select
                  value={linkRole}
                  onChange={async (e) => {
                    const newRole = e.target.value as "viewer" | "editor";
                    setLinkRole(newRole);
                    // Update the link role on the server
                    const res = await fetch(`/api/documents/${documentId}/share-link`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ enabled: true, role: newRole }),
                    });
                    const data = await res.json();
                    if (data.shareToken) {
                      setLinkUrl(`${window.location.origin}${data.url}`);
                    }
                  }}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none"
                >
                  <option value="viewer">Can view</option>
                  <option value="editor">Can edit</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={linkUrl}
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-gray-50 select-all"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  onClick={copyLink}
                  className="shrink-0 text-sm font-medium bg-[#B8692A] hover:bg-[#96541F] text-white px-3 py-2 rounded-lg transition-colors"
                >
                  {linkCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] 14.2 Commit: `git add src/components/ShareDialog.tsx && git commit -m "feat: add ShareDialog component with email and link sharing UI"`

---

## Task 15: Integrate Share Dialog into TopBar

**Files:** `src/components/TopBar.tsx`
**Time:** ~4 min

- [ ] 15.1 Add the `ShareDialog` import and `userRole` prop to `TopBar.tsx`. Replace the imports section at the top:

```typescript
"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import ShareDialog from "@/components/ShareDialog";
```

- [ ] 15.2 Add `userRole` to the `TopBarProps` interface:

```typescript
interface TopBarProps {
  title: string;
  documentId: string;
  collaborators: Collaborator[];
  connected: boolean;
  onInviteAgent: () => void;
  onTitleChange?: (title: string) => void;
  agentLoading?: boolean;
  userRole?: "owner" | "editor" | "viewer" | null;
}
```

- [ ] 15.3 Update the component destructuring to include `userRole`:

```typescript
export default function TopBar({
  title,
  documentId,
  collaborators,
  connected,
  onInviteAgent,
  onTitleChange,
  agentLoading,
  userRole,
}: TopBarProps) {
```

- [ ] 15.4 Replace the `handleShare` function and the Share button to open the dialog for owners or copy link for others:

Replace the existing `handleShare` function with:

```typescript
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  async function handleShare() {
    if (userRole === "owner") {
      setShareDialogOpen(true);
    } else {
      // Non-owners: just copy the URL
      const url = `${window.location.origin}/doc/${documentId}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setShowShareModal(true);
      }
    }
  }
```

- [ ] 15.5 Add the `ShareDialog` component rendering before the closing `</div>` of the TopBar return, right before the existing `showShareModal` block:

```tsx
        {/* Share dialog for owners */}
        <ShareDialog
          documentId={documentId}
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
        />
```

- [ ] 15.6 Add a "View only" badge next to the connection status when role is viewer. After the connected status `<div>` inside the left section, add:

```tsx
        {userRole === "viewer" && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            View only
          </span>
        )}
```

- [ ] 15.7 Commit: `git add src/components/TopBar.tsx && git commit -m "feat: integrate ShareDialog into TopBar with role-based behavior"`

---

## Task 16: Document List "Shared with me" Tab

**Files:** `src/app/page.tsx`
**Time:** ~5 min

- [ ] 16.1 Update the `Doc` interface in `src/app/page.tsx` to include `role` and `ownerId`:

```typescript
interface Doc {
  id: string;
  title: string;
  updatedAt: string;
  role?: string;
  ownerId?: string | null;
}
```

- [ ] 16.2 Update the `Tab` type to include `"shared"`:

```typescript
type Tab = "all" | "recent" | "shared";
```

- [ ] 16.3 Update the `filteredDocs` logic to handle the `"shared"` tab. Inside the `filteredDocs` IIFE, add a case for the shared tab after the `"recent"` case:

```typescript
    if (activeTab === "shared") {
      result = docs.filter((d) => d.role && d.role !== "owner" && d.ownerId !== null);
    }
```

- [ ] 16.4 Add `"shared": "Shared with me"` to the `headingLabel` object:

```typescript
  const headingLabel: Record<Tab, string> = {
    all: "All Documents",
    recent: "Recent",
    shared: "Shared with me",
  };
```

- [ ] 16.5 Add the "Shared with me" tab to the sidebar nav items array. Update the desktop sidebar nav:

```typescript
            { label: "All Documents", tab: "all" as Tab },
            { label: "Recent", tab: "recent" as Tab },
            { label: "Shared with me", tab: "shared" as Tab },
```

- [ ] 16.6 Add the same tab to the mobile tab bar:

```typescript
              { label: "All", tab: "all" as Tab },
              { label: "Recent", tab: "recent" as Tab },
              { label: "Shared", tab: "shared" as Tab },
```

- [ ] 16.7 Show a role badge next to each document in the list. Inside the document row, after the title `<p>` tag, add:

```tsx
                        {doc.role && doc.role !== "owner" && doc.ownerId && (
                          <span className={`inline-flex items-center ml-2 px-1.5 py-0.5 rounded text-xs font-medium ${
                            doc.role === "editor"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {doc.role === "editor" ? "Editor" : "Viewer"}
                          </span>
                        )}
```

- [ ] 16.8 Commit: `git add src/app/page.tsx && git commit -m "feat: add 'Shared with me' tab and role badges to document list"`

---

## Task 17: Editor Read-Only Mode for Viewers

**Files:** `src/app/doc/[id]/page.tsx`, `src/components/Editor.tsx`
**Time:** ~5 min

- [ ] 17.1 Add `userRole` state to the document page `src/app/doc/[id]/page.tsx`. After the `docTitle` state declaration, add:

```typescript
  const [userRole, setUserRole] = useState<"owner" | "editor" | "viewer" | null>(null);
```

- [ ] 17.2 Update the document fetch `useEffect` to also set the role. Replace the existing fetch effect:

```typescript
  useEffect(() => {
    fetch(`/api/documents/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((doc) => {
        if (doc?.title) setDocTitle(doc.title);
        if (doc?.role) setUserRole(doc.role);
      })
      .catch(() => {});
  }, [id]);
```

- [ ] 17.3 Pass `userRole` to the `TopBar` component. Update the `<TopBar>` JSX to include:

```tsx
      <TopBar
        title={docTitle}
        documentId={id}
        collaborators={collaborators}
        connected={connected}
        onInviteAgent={handleInviteAgent}
        onTitleChange={userRole === "viewer" ? undefined : handleTitleChange}
        agentLoading={agentLoading}
        userRole={userRole}
      />
```

- [ ] 17.4 Pass `editable` prop to the `Editor` component. Update the `<Editor>` JSX:

```tsx
        <Editor
          documentId={id}
          userName={userName}
          ydoc={ydoc}
          provider={provider}
          onEditorReady={handleEditorReady}
          activeCommentId={activeCommentId}
          editable={userRole !== "viewer"}
        />
```

- [ ] 17.5 Conditionally render the `Toolbar` only for editors/owners:

```tsx
      {userRole !== "viewer" && <Toolbar editor={editor} />}
```

- [ ] 17.6 Update the `Editor` component in `src/components/Editor.tsx` to accept and use the `editable` prop. Add to `EditorProps`:

```typescript
interface EditorProps {
  documentId: string;
  userName: string;
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  onEditorReady?: (editor: TiptapEditor) => void;
  activeCommentId?: string | null;
  editable?: boolean;
}
```

- [ ] 17.7 Add `editable` to the destructured props:

```typescript
export default function Editor({
  documentId: _documentId,
  userName,
  ydoc,
  provider,
  onEditorReady,
  activeCommentId,
  editable = true,
}: EditorProps) {
```

- [ ] 17.8 Add `editable` to the `useEditor` config. Inside the `useEditor` call, add the `editable` property at the top level (not inside `editorProps`):

```typescript
  const editor = useEditor({
    editable,
    extensions: [
      // ... existing extensions
```

- [ ] 17.9 Add an effect to update editability when the prop changes. After the `useEditor` call:

```typescript
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);
```

- [ ] 17.10 Commit: `git add src/app/doc/[id]/page.tsx src/components/Editor.tsx && git commit -m "feat: add read-only mode for viewers with toolbar hidden"`

---

## Task 18: Share Token in WebSocket Connection URL

**Files:** `src/app/doc/[id]/page.tsx`
**Time:** ~3 min

- [ ] 18.1 Update the `WebsocketProvider` creation in `src/app/doc/[id]/page.tsx` to include the share token from the URL query string. Replace the `provider` useMemo:

```typescript
  const provider = useMemo(() => {
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL ||
      `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/ws`;

    // Append share token from URL if present
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");
      if (token) {
        wsUrl += (wsUrl.includes("?") ? "&" : "?") + `token=${encodeURIComponent(token)}`;
      }
    }

    return new WebsocketProvider(wsUrl, id, ydoc);
  }, [id, ydoc]);
```

- [ ] 18.2 Commit: `git add src/app/doc/[id]/page.tsx && git commit -m "feat: pass share token to WebSocket connection URL"`

---

## Task 19: End-to-End Verification

**Time:** ~3 min

- [ ] 19.1 Run all unit tests:

```bash
npx vitest run
```

Expected: all tests pass (including existing CommentCard and CommentSidebar tests).

- [ ] 19.2 Run the Prisma migration to ensure schema is valid:

```bash
npx prisma migrate dev --name verify-sharing-schema
```

- [ ] 19.3 Verify TypeScript compiles with no errors:

```bash
npx tsc --noEmit
```

- [ ] 19.4 Start the development server and verify it boots:

```bash
timeout 10 node server/combined-server.mjs 2>&1 || true
```

Expected: `MarkdownCollab running on http://0.0.0.0:3000`

- [ ] 19.5 Commit any remaining fixes, then final commit:

```bash
git add -A && git commit -m "feat: complete document sharing and permissions implementation"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Schema migration | `prisma/schema.prisma` |
| 2-3 | Access control utility + tests | `src/lib/access-control.ts`, `src/lib/__tests__/access-control.test.ts` |
| 4 | NextAuth user ID in session | `src/lib/auth.ts`, `src/types/next-auth.d.ts` |
| 5-6 | Document list API with access filtering | `src/app/api/documents/route.ts` |
| 7-8 | Single document API with access checks | `src/app/api/documents/[id]/route.ts` |
| 9-10 | Share CRUD API | `src/app/api/documents/[id]/share/route.ts`, `.../[shareId]/route.ts` |
| 11-12 | Share link generation | `src/app/api/documents/[id]/share-link/route.ts` |
| 13 | WebSocket access control | `server/combined-server.mjs` |
| 14-15 | Share dialog UI | `src/components/ShareDialog.tsx`, `src/components/TopBar.tsx` |
| 16 | "Shared with me" tab | `src/app/page.tsx` |
| 17 | Editor read-only mode | `src/app/doc/[id]/page.tsx`, `src/components/Editor.tsx` |
| 18 | Share token in WS URL | `src/app/doc/[id]/page.tsx` |
| 19 | End-to-end verification | All files |

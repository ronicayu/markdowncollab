import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const markdownDir = process.env.MARKDOWN_DIR || "./documents";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET: Search across all accessible documents, return matches with context.
 * Query params: q (search term)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const accessibleDocs = await getAccessibleDocs(userId, userEmail);
  const docMap = new Map(accessibleDocs.map((d) => [d.id, d]));

  if (!existsSync(markdownDir)) {
    return NextResponse.json([]);
  }

  const results: {
    documentId: string;
    title: string;
    matches: { lineNumber: number; context: string }[];
  }[] = [];

  const lowerQuery = query.toLowerCase();

  try {
    const files = readdirSync(markdownDir);
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const docId = f.replace(/\.md$/, "");
      const doc = docMap.get(docId);
      if (!doc) continue;

      try {
        const content = readFileSync(join(markdownDir, f), "utf-8");
        const lines = content.split("\n");
        const docMatches: { lineNumber: number; context: string }[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(lowerQuery)) {
            // Build context snippet with match highlighted
            const line = lines[i];
            const idx = line.toLowerCase().indexOf(lowerQuery);
            const before = escapeHtml(line.slice(0, idx));
            const match = escapeHtml(line.slice(idx, idx + query.length));
            const after = escapeHtml(line.slice(idx + query.length));
            docMatches.push({
              lineNumber: i + 1,
              context: `${before}<mark>${match}</mark>${after}`,
            });
          }
        }

        if (docMatches.length > 0) {
          results.push({
            documentId: docId,
            title: doc.title,
            matches: docMatches,
          });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory read failed
  }

  return NextResponse.json(results);
}

/**
 * POST: Perform search and replace across documents.
 * Body: { search, replace, documentId? }
 * If documentId is provided, only replace in that document.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const { search, replace, documentId } = body as {
    search?: string;
    replace?: string;
    documentId?: string;
  };

  if (!search || typeof replace !== "string") {
    return NextResponse.json(
      { error: "Missing 'search' and 'replace' in request body" },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const accessibleDocs = await getAccessibleDocs(userId, userEmail);
  const docMap = new Map(accessibleDocs.map((d) => [d.id, d]));

  if (!existsSync(markdownDir)) {
    return NextResponse.json({ replacements: [] });
  }

  const replacements: { documentId: string; title: string; count: number }[] = [];

  try {
    const files = readdirSync(markdownDir);
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const docId = f.replace(/\.md$/, "");
      if (documentId && docId !== documentId) continue;
      const doc = docMap.get(docId);
      if (!doc) continue;

      try {
        const filePath = join(markdownDir, f);
        const content = readFileSync(filePath, "utf-8");

        // Count occurrences (case-insensitive search, but preserve-case replacement)
        const regex = new RegExp(
          search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "gi"
        );
        const matchCount = (content.match(regex) || []).length;

        if (matchCount > 0) {
          const newContent = content.replace(regex, replace);
          writeFileSync(filePath, newContent, "utf-8");
          replacements.push({
            documentId: docId,
            title: doc.title,
            count: matchCount,
          });
        }
      } catch {
        // Skip unwritable files
      }
    }
  } catch {
    // Directory read failed
  }

  return NextResponse.json({ replacements });
}

async function getAccessibleDocs(
  userId: string | undefined,
  userEmail: string | undefined
): Promise<{ id: string; title: string }[]> {
  if (!userId) {
    return prisma.document.findMany({
      where: { ownerId: null, deletedAt: null },
      select: { id: true, title: true },
    });
  }

  const shares = await prisma.documentShare.findMany({
    where: {
      OR: [
        { userId },
        ...(userEmail ? [{ email: userEmail.toLowerCase() }] : []),
      ],
    },
    select: { documentId: true },
  });
  const sharedDocIds = shares.map((s) => s.documentId);

  return prisma.document.findMany({
    where: {
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { ownerId: null },
        { id: { in: sharedDocIds } },
      ],
    },
    select: { id: true, title: true },
  });
}

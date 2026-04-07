import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const markdownDir = process.env.MARKDOWN_DIR || "./documents";

/**
 * Escape HTML special chars to prevent XSS in snippets.
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Extract a ~100 char snippet around the first match, with the match highlighted in <mark> tags.
 */
function extractSnippet(content: string, query: string): string | null {
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerContent.indexOf(lowerQuery);
  if (idx === -1) return null;

  const contextChars = 50;
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(content.length, idx + query.length + contextChars);

  let snippet = content.slice(start, end);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < content.length ? "..." : "";

  // Find the match within the snippet and wrap it
  const matchStart = idx - start;
  const matchEnd = matchStart + query.length;
  const before = escapeHtml(snippet.slice(0, matchStart));
  const match = escapeHtml(snippet.slice(matchStart, matchEnd));
  const after = escapeHtml(snippet.slice(matchEnd));

  return `${prefix}${before}<mark>${match}</mark>${after}${suffix}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  // Get accessible document IDs for this user
  let accessibleDocs: { id: string; title: string; updatedAt: Date }[];

  if (!userId) {
    // Unauthenticated: only legacy docs
    accessibleDocs = await prisma.document.findMany({
      where: { ownerId: null, deletedAt: null },
      select: { id: true, title: true, updatedAt: true },
    });
  } else {
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

    accessibleDocs = await prisma.document.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerId: userId },
          { ownerId: null },
          { id: { in: sharedDocIds } },
        ],
      },
      select: { id: true, title: true, updatedAt: true },
    });
  }

  const lowerQuery = query.toLowerCase();

  // Build a map of accessible docs for quick lookup
  const docMap = new Map(accessibleDocs.map((d) => [d.id, d]));

  // Collect markdown file contents for accessible docs
  const mdFiles = new Set<string>();
  if (existsSync(markdownDir)) {
    try {
      const files = readdirSync(markdownDir);
      for (const f of files) {
        if (f.endsWith(".md")) {
          const docId = f.replace(/\.md$/, "");
          if (docMap.has(docId)) {
            mdFiles.add(docId);
          }
        }
      }
    } catch {
      // Directory read failed, skip content search
    }
  }

  const results: { id: string; title: string; snippet: string; updatedAt: string }[] = [];
  const addedIds = new Set<string>();

  for (const doc of accessibleDocs) {
    const titleMatch = doc.title.toLowerCase().includes(lowerQuery);

    let contentSnippet: string | null = null;
    if (mdFiles.has(doc.id)) {
      try {
        const content = readFileSync(join(markdownDir, `${doc.id}.md`), "utf-8");
        contentSnippet = extractSnippet(content, query);
      } catch {
        // File read failed, skip
      }
    }

    if (titleMatch || contentSnippet) {
      if (!addedIds.has(doc.id)) {
        addedIds.add(doc.id);
        results.push({
          id: doc.id,
          title: doc.title,
          snippet: contentSnippet || "",
          updatedAt: doc.updatedAt.toISOString(),
        });
      }
    }
  }

  // Sort by updatedAt descending
  results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json(results);
}

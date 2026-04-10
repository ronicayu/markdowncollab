import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/agent/suggest-links
 * Body: { documentId: string }
 * Returns top 3 related documents based on keyword overlap.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const rateResult = checkRateLimit(`agent-suggest-links:${userId}`, 30, 2_000);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateResult.retryAfter },
      { status: 429 }
    );
  }

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return NextResponse.json({ error: "documentId required" }, { status: 400 });
    }

    // Get the current document
    const currentDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, title: true },
    });
    if (!currentDoc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get all other documents
    const allDocs = await prisma.document.findMany({
      where: { id: { not: documentId }, deletedAt: null },
      select: { id: true, title: true },
    });

    if (allDocs.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Extract keywords from current doc title
    const currentWords = extractKeywords(currentDoc.title);

    // Score each doc by word overlap with current doc title
    const scored = allDocs
      .map((doc) => {
        const docWords = extractKeywords(doc.title);
        const overlap = computeOverlap(currentWords, docWords);
        return { id: doc.id, title: doc.title, score: overlap };
      })
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return NextResponse.json({ suggestions: scored });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "nor", "so", "yet", "both", "either", "neither", "each",
    "every", "all", "any", "few", "more", "most", "other", "some", "such",
    "than", "too", "very", "just", "about", "up", "out", "if", "then",
    "it", "its", "this", "that", "these", "those", "my", "your", "his",
    "her", "our", "their", "what", "which", "who", "whom", "whose",
    "untitled",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

function computeOverlap(wordsA: string[], wordsB: string[]): number {
  if (wordsA.length === 0 || wordsB.length === 0) return 0;
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let overlap = 0;
  for (const w of setA) {
    if (setB.has(w)) overlap++;
  }
  // Normalize by the smaller set
  return overlap / Math.min(setA.size, setB.size);
}

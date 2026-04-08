import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentIds, email, role } = await req.json();
  if (!Array.isArray(documentIds) || !email || !["viewer", "editor"].includes(role)) {
    return NextResponse.json({ error: "documentIds, email, and valid role required" }, { status: 400 });
  }

  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  // Rate limit: 10 bulk share operations per minute per user
  const rateLimitKey = `bulk-share:${userId}`;
  const rateResult = checkRateLimit(rateLimitKey, 10, 6_000);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: rateResult.retryAfter },
      { status: 429 }
    );
  }

  let created = 0;
  for (const docId of documentIds) {
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (doc?.ownerId !== userId) continue;
    try {
      await prisma.documentShare.create({
        data: { documentId: docId, email: email.toLowerCase(), role },
      });
      created++;
    } catch { /* Skip duplicates */ }
  }

  return NextResponse.json({ ok: true, shared: created });
}

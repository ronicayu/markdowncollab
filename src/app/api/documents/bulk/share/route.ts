import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentIds, email, role } = await req.json();
  if (!Array.isArray(documentIds) || !email || !["viewer", "editor"].includes(role)) {
    return NextResponse.json({ error: "documentIds, email, and valid role required" }, { status: 400 });
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

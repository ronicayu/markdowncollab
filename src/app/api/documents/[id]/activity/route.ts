import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";

const PAGE_SIZE = 20;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null,
    undefined,
    "viewer"
  );
  if (!access.hasAccess) {
    return NextResponse.json(
      { error: "Not authorized to view this document" },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  const [activities, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.activityLog.count({
      where: { documentId: id },
    }),
  ]);

  return NextResponse.json({ activities, total, page, pageSize: PAGE_SIZE });
}

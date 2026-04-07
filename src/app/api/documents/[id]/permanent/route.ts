import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkDocumentAccess } from "@/lib/access-control";
import { unlink, rm } from "fs/promises";
import { join } from "path";

const YJS_DIR = process.env.YPERSISTENCE || "./yjs-data";
const MD_DIR = process.env.MARKDOWN_DIR || "./documents";
const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null, undefined, "owner");
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!doc.deletedAt) {
    return NextResponse.json({ error: "Document must be in trash before permanent deletion" }, { status: 400 });
  }

  await prisma.document.delete({ where: { id } });
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
    rm(join(UPLOADS_DIR, id), { recursive: true, force: true }),
  ]);

  return NextResponse.json({ ok: true });
}

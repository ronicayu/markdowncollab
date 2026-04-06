import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { join } from "path";

const YJS_DIR = process.env.YPERSISTENCE || "./yjs-data";
const MD_DIR = process.env.MARKDOWN_DIR || "./documents";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { title } = await req.json();
  const doc = await prisma.document.update({ where: { id }, data: { title } });
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.document.delete({ where: { id } });
  // Clean up associated content files
  await Promise.allSettled([
    unlink(join(YJS_DIR, `${id}.bin`)),
    unlink(join(MD_DIR, `${id}.md`)),
  ]);
  return NextResponse.json({ ok: true });
}

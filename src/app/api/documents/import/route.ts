import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const name = file.name.toLowerCase();
  let title = file.name.replace(/\.(md|docx|html?)$/i, "");

  if (name.endsWith(".md")) {
    const text = await file.text();
    const doc = await prisma.document.create({ data: { title, ownerId: userId } });
    return NextResponse.json({ id: doc.id, format: "markdown", content: text });
  } else if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await mammoth.convertToHtml({ buffer });
    const doc = await prisma.document.create({ data: { title, ownerId: userId } });
    return NextResponse.json({ id: doc.id, format: "html", content: result.value });
  } else if (name.endsWith(".html") || name.endsWith(".htm")) {
    const html = await file.text();
    const doc = await prisma.document.create({ data: { title, ownerId: userId } });
    return NextResponse.json({ id: doc.id, format: "html", content: html });
  }

  return NextResponse.json({ error: "Unsupported format. Use .md, .docx, or .html" }, { status: 400 });
}

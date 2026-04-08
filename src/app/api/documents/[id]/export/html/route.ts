import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToHtml, wrapInHtmlTemplate } from "@/lib/export-html";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check — viewer role is sufficient for export
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(id, userId ?? null, userEmail ?? null);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const wsUrl = process.env.WS_URL || "ws://localhost:3000/ws";
  let cleanup: (() => void) | null = null;

  try {
    // Connect to Yjs and extract HTML
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const htmlContent = xmlFragmentToHtml(yxml);
    const fullHtml = wrapInHtmlTemplate(htmlContent);

    // Sanitize filename to prevent header injection
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(fullHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeId}.html"`,
      },
    });
  } catch (error) {
    console.error("HTML export error:", error);
    return NextResponse.json({ error: "HTML export failed" }, { status: 500 });
  } finally {
    cleanup?.();
  }
}

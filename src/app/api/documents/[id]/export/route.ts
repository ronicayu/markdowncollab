import { NextResponse } from "next/server";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { cleanMarkdown } from "@/lib/export-markdown";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wsUrl = process.env.WS_URL || "ws://localhost:1234";
  let cleanup: (() => void) | null = null;

  try {
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const html = yxml.toJSON();
    const markdown = cleanMarkdown(html);

    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${id}.md"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  } finally {
    cleanup?.();
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import puppeteer from "puppeteer";
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
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // Connect to Yjs and extract HTML
    const conn = await connectYjsServer(wsUrl, id);
    cleanup = conn.cleanup;
    const yxml = conn.ydoc.getXmlFragment("default");
    const htmlContent = xmlFragmentToHtml(yxml);
    const fullHtml = wrapInHtmlTemplate(htmlContent);

    // Render to PDF via Puppeteer
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // Block all external network requests for security
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:") || request.url() === "about:blank") {
        request.continue();
      } else {
        request.abort();
      }
    });

    await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });

    // Sanitize filename to prevent header injection
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeId}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF export error:", error);
    return NextResponse.json({ error: "PDF export failed" }, { status: 500 });
  } finally {
    cleanup?.();
    if (browser) {
      await browser.close();
    }
  }
}

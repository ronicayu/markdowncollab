import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import { connectYjsServer } from "@/lib/yjs-server-connect";
import { xmlFragmentToHtml, wrapInHtmlTemplate } from "@/lib/export-html";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      printBackground: true,
    });

    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${id}.pdf"`,
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

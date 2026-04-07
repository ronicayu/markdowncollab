import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkDocumentAccess } from "@/lib/access-control";
import { validateImageFile, extensionFromMime } from "@/lib/upload-utils";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate document ID to prevent path traversal
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid document ID" }, { status: 400 });
  }

  // Auth check
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const userEmail = session?.user?.email ?? undefined;

  const access = await checkDocumentAccess(
    id,
    userId ?? null,
    userEmail ?? null,
    undefined,
    "editor"
  );
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file
  const validation = validateImageFile(file.type, file.size);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Create upload directory for this document
  const docUploadsDir = join(UPLOADS_DIR, id);
  await mkdir(docUploadsDir, { recursive: true });

  // Generate unique filename
  const ext = extensionFromMime(file.type);
  const filename = `${randomUUID()}.${ext}`;
  const filePath = join(docUploadsDir, filename);

  // Write file to disk
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  // Return the URL that can be used to serve the file
  const url = `/api/documents/${id}/uploads/${filename}`;

  return NextResponse.json({ url });
}

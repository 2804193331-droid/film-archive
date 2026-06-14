import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { resolveStorageFile, type StorageKind } from "@/lib/storage";

export const runtime = "nodejs";

const allowedKinds = new Set(["originals", "previews", "thumbnails", "avatars"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kind: string; assetPath: string[] }> }
) {
  const params = await context.params;
  if (!allowedKinds.has(params.kind)) {
    return NextResponse.json({ error: "Invalid asset kind." }, { status: 400 });
  }

  const relativePath = params.assetPath.join("/");
  const filePath = await resolveStorageFile(params.kind as StorageKind, relativePath);
  if (!filePath) {
    return NextResponse.json({ error: "Storage is not configured." }, { status: 404 });
  }

  try {
    const file = await fs.readFile(filePath);
    const headers = new Headers({
      "Content-Type": contentTypeFor(filePath),
      "Cache-Control": "public, max-age=31536000, immutable"
    });

    if (request.nextUrl.searchParams.get("download")) {
      headers.set("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    }

    return new NextResponse(file, { headers });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}

function contentTypeFor(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".tif":
    case ".tiff":
      return "image/tiff";
    default:
      return "application/octet-stream";
  }
}

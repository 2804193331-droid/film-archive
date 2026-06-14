import { NextRequest, NextResponse } from "next/server";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { canManageStorage } from "@/lib/admin";
import { rescanLocalPhotos } from "@/lib/local-library";
import { getConfiguredUploadDir, getStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!canManageStorage(session)) {
    return NextResponse.json({ error: "Only administrators can manage storage." }, { status: 403 });
  }

  const status = await getStorageStatus();
  const uploadDir = await getConfiguredUploadDir();

  if (!uploadDir || !status.configured || !status.online || status.readOnly) {
    return NextResponse.json({ error: "照片存储目录不可用。" }, { status: 423 });
  }

  const recovered = await rescanLocalPhotos(uploadDir);
  return NextResponse.json({ recovered });
}

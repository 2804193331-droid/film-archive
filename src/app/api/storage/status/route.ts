import { NextRequest, NextResponse } from "next/server";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { isAdminSession } from "@/lib/admin";
import { getStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const status = await getStorageStatus();
  const session = getAppSessionFromRequest(request);
  if (process.env.NODE_ENV === "production" && !isAdminSession(session)) {
    return NextResponse.json({
      configured: status.configured,
      online: status.online,
      readOnly: status.readOnly,
      usedBytes: 0,
      imageCount: 0,
      missingDirs: status.missingDirs
    });
  }

  return NextResponse.json(status);
}

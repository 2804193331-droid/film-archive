import { NextRequest, NextResponse } from "next/server";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { canManageStorage } from "@/lib/admin";
import { detectStorageCandidates } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!canManageStorage(session)) {
    return NextResponse.json({ error: "Only administrators can manage storage." }, { status: 403 });
  }

  const candidates = await detectStorageCandidates();
  return NextResponse.json({ candidates });
}

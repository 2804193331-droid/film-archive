import { NextRequest, NextResponse } from "next/server";
import { clearAppSessionCookie, getAppSessionFromRequest } from "@/lib/app-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json({ user: getAppSessionFromRequest(request) });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAppSessionCookie(response);
  return response;
}

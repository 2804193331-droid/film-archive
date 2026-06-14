import { NextRequest, NextResponse } from "next/server";
import { canAccessAdmin } from "@/lib/admin";
import { clearAppSessionCookie, getAppSessionFromRequest } from "@/lib/app-session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = getAppSessionFromRequest(request);
  return NextResponse.json({ user, isAdmin: canAccessAdmin(user) });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAppSessionCookie(response);
  return response;
}

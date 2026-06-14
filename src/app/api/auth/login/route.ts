import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidUsername, normalizeUsername, usernameHelpText, usernameToAuthEmail } from "@/lib/auth-identity";
import { setAppSessionCookie } from "@/lib/app-session";
import { createSupabaseAuthClient } from "@/lib/supabase";

export const runtime = "nodejs";

const loginSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6)
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success || !isValidUsername(parsed.data.username)) {
    return NextResponse.json({ error: usernameHelpText }, { status: 400 });
  }

  const supabase = createSupabaseAuthClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase 尚未配置，无法登录。" }, { status: 503 });
  }

  const username = normalizeUsername(parsed.data.username);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: usernameToAuthEmail(username),
    password: parsed.data.password
  });

  if (error || !data.user) {
    return NextResponse.json({ error: "用户名或密码不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  setAppSessionCookie(response, {
    id: data.user.id,
    username,
    displayName: data.user.user_metadata?.display_name ?? data.user.user_metadata?.username ?? username,
    email: data.user.email,
    avatarUrl: data.user.user_metadata?.avatar_url,
    createdAt: data.user.created_at
  });
  return response;
}

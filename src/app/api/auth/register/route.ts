import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isValidUsername, normalizeUsername, usernameHelpText, usernameToAuthEmail } from "@/lib/auth-identity";
import { setAppSessionCookie } from "@/lib/app-session";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6)
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success || !isValidUsername(parsed.data.username)) {
    return NextResponse.json({ error: usernameHelpText }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "请先配置 Supabase URL 和 SUPABASE_SERVICE_ROLE_KEY。" },
      { status: 503 }
    );
  }

  const username = normalizeUsername(parsed.data.username);
  const email = usernameToAuthEmail(username);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (existingProfile?.id) {
    return NextResponse.json({ error: "这个用户名已经被注册。" }, { status: 409 });
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      username,
      display_name: username
    }
  });

  if (error || !data.user) {
    const message = error?.message.includes("already")
      ? "这个用户名已经被注册。"
      : error?.message ?? "注册失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await supabase.from("profiles").upsert({
    id: data.user.id,
    username,
    display_name: username
  });

  const response = NextResponse.json({ ok: true });
  setAppSessionCookie(response, {
    id: data.user.id,
    username,
    displayName: username,
    email: data.user.email ?? email,
    avatarUrl: data.user.user_metadata?.avatar_url,
    createdAt: data.user.created_at
  });
  return response;
}

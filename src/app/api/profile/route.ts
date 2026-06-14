import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod";
import { getAppSessionFromRequest, setAppSessionCookie } from "@/lib/app-session";
import { updateLocalUploaderProfile } from "@/lib/local-library";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getConfiguredUploadDir } from "@/lib/storage";

export const runtime = "nodejs";

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  avatarUrl: z.string().trim().max(500).optional()
});

const MAX_AVATAR_SIZE = 8 * 1024 * 1024;
const AVATAR_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

export async function PATCH(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  try {
    const payload = await readProfilePayload(request);
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "昵称或头像格式不正确。" }, { status: 400 });
    }

    let avatarUrl = payload.keepAvatarUrl ?? normalizeAvatarUrl(parsed.data.avatarUrl);
    if (payload.avatarFile) {
      const uploadDir = await getConfiguredUploadDir();
      if (!uploadDir) {
        return NextResponse.json({ error: "请先配置照片存储目录，再上传头像。" }, { status: 503 });
      }

      avatarUrl = await saveAvatarFile(uploadDir, session.id, payload.avatarFile);
    }

    const nextSession = {
      ...session,
      displayName: parsed.data.displayName,
      avatarUrl
    };

    const supabase = createSupabaseAdminClient();
    if (supabase) {
      await supabase
        .from("profiles")
        .update({
          display_name: nextSession.displayName,
          avatar_url: avatarUrl ?? null
        })
        .eq("id", session.id);

      await supabase.auth.admin.updateUserById(session.id, {
        user_metadata: {
          username: session.username,
          display_name: nextSession.displayName,
          avatar_url: avatarUrl
        }
      });
    }

    const uploadDir = await getConfiguredUploadDir();
    if (uploadDir) {
      await updateLocalUploaderProfile({
        uploadDir,
        userId: session.id,
        displayName: nextSession.displayName,
        avatarUrl: nextSession.avatarUrl
      }).catch(() => undefined);
    }

    const response = NextResponse.json({ user: nextSession });
    setAppSessionCookie(response, nextSession);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 400 }
    );
  }
}

async function readProfilePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const avatar = form.get("avatar");

    return {
      displayName: readFormText(form, "displayName"),
      avatarUrl: undefined,
      keepAvatarUrl: readFormText(form, "keepAvatarUrl") || undefined,
      avatarFile: avatar instanceof File && avatar.size > 0 ? avatar : undefined
    };
  }

  const body = await request.json().catch(() => null);
  return {
    displayName: typeof body?.displayName === "string" ? body.displayName : "",
    avatarUrl: typeof body?.avatarUrl === "string" ? body.avatarUrl : undefined,
    keepAvatarUrl: undefined,
    avatarFile: undefined
  };
}

async function saveAvatarFile(uploadDir: string, userId: string, file: File) {
  const extension = path.extname(file.name).toLowerCase();
  if (!AVATAR_EXTENSIONS.has(extension)) {
    throw new Error("头像格式不支持。");
  }

  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("头像不能超过 8MB。");
  }

  const avatarsDir = path.join(uploadDir, "avatars", userId);
  await fs.mkdir(avatarsDir, { recursive: true });

  const filename = `${randomUUID()}.jpg`;
  const target = path.join(avatarsDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(512, 512, { fit: "cover" })
    .jpeg({ quality: 86 })
    .toFile(target);

  return `/api/assets/avatars/${userId}/${filename}`;
}

function readFormText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAvatarUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

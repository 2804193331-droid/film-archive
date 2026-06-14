import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { createSignedUploads, OSS_BUCKET } from "@/lib/oss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fileSchema = z.object({
  name: z.string().min(1).max(260),
  size: z.number().positive(),
  type: z.string().optional()
});

const signSchema = z.object({
  albumId: z.string().uuid().optional(),
  files: z.array(fileSchema).min(1).max(100)
});

export async function POST(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录后再上传。" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "上传文件信息无效。" }, { status: 400 });
  }

  try {
    const albumId = parsed.data.albumId ?? randomUUID();
    const uploads = createSignedUploads({
      files: parsed.data.files,
      userId: session.id,
      albumId
    });

    return NextResponse.json({
      albumId,
      bucket: OSS_BUCKET,
      uploads
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成 OSS 上传签名失败。" },
      { status: 400 }
    );
  }
}

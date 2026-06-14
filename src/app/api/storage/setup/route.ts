import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { canManageStorage } from "@/lib/admin";
import { writeUploadDirConfig } from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  uploadDir: z.string().min(2)
});

export async function POST(request: NextRequest) {
  const session = getAppSessionFromRequest(request);
  if (!canManageStorage(session)) {
    return NextResponse.json({ error: "Only administrators can manage storage." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "存储路径无效。" }, { status: 400 });
  }

  try {
    const uploadDir = await writeUploadDirConfig(parsed.data.uploadDir);
    return NextResponse.json({ uploadDir });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "无法创建存储目录。" },
      { status: 500 }
    );
  }
}

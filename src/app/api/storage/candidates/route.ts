import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "本地硬盘存储已迁移为阿里云 OSS。" }, { status: 410 });
}

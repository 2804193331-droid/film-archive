import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "阿里云 OSS 模式不支持本地目录扫描。" }, { status: 410 });
}

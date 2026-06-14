import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "图片已迁移为阿里云 OSS URL，请直接访问数据库中的图片地址。" }, { status: 410 });
}

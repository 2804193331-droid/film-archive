import { NextResponse } from "next/server";
import { isOssConfigured, OSS_BUCKET, OSS_ENDPOINT, OSS_REGION } from "@/lib/oss";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    provider: "aliyun-oss",
    configured: isOssConfigured(),
    bucket: OSS_BUCKET,
    region: OSS_REGION,
    endpoint: OSS_ENDPOINT,
    online: isOssConfigured(),
    readOnly: !isOssConfigured()
  });
}

import path from "node:path";
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";

export const OSS_BUCKET = process.env.ALI_OSS_BUCKET || "film-archive-images";
export const OSS_ENDPOINT = stripProtocol(process.env.ALI_OSS_ENDPOINT || "oss-cn-shanghai.aliyuncs.com");
export const OSS_REGION = normalizeRegion(process.env.ALI_OSS_REGION || "cn-shanghai");
export const MAX_UPLOAD_FILES = 100;
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);
const DEFAULT_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff"
};

export type SignedUpload = {
  id: string;
  originalKey: string;
  originalUrl: string;
  previewUrl: string;
  thumbnailUrl: string;
  uploadUrl: string;
  mimeType: string;
  size: number;
  filename: string;
};

export type UploadFileInput = {
  name: string;
  size: number;
  type?: string;
};

export function isOssConfigured() {
  return Boolean(process.env.ALI_OSS_ACCESS_KEY_ID && process.env.ALI_OSS_ACCESS_KEY_SECRET);
}

export function assertOssConfigured() {
  if (!isOssConfigured()) {
    throw new Error("阿里云 OSS 尚未配置，请设置 ALI_OSS_ACCESS_KEY_ID 和 ALI_OSS_ACCESS_KEY_SECRET。");
  }
}

export function createOssClient() {
  assertOssConfigured();

  return new OSS({
    region: OSS_REGION,
    endpoint: OSS_ENDPOINT,
    accessKeyId: process.env.ALI_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALI_OSS_ACCESS_KEY_SECRET,
    bucket: OSS_BUCKET,
    secure: true,
    timeout: "120s"
  });
}

export function validateUploadFiles(files: UploadFileInput[]) {
  if (!files.length) {
    throw new Error("没有收到照片文件。");
  }

  if (files.length > MAX_UPLOAD_FILES) {
    throw new Error(`一次最多上传 ${MAX_UPLOAD_FILES} 张照片。`);
  }

  for (const file of files) {
    const extension = normalizedImageExtension(file.name);
    if (!extension) {
      throw new Error(`${file.name} 格式不支持。`);
    }

    if (!Number.isFinite(file.size) || file.size <= 0) {
      throw new Error(`${file.name} 文件大小无效。`);
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error(`${file.name} 超过 100MB。`);
    }
  }
}

export function createSignedUploads({
  files,
  userId,
  albumId
}: {
  files: UploadFileInput[];
  userId: string;
  albumId: string;
}) {
  validateUploadFiles(files);

  const client = createOssClient();
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return files.map((file): SignedUpload => {
    const id = randomUUID();
    const extension = normalizedImageExtension(file.name) ?? ".jpg";
    const mimeType = normalizeMimeType(file.type, extension);
    const originalKey = `originals/${userId}/${year}/${month}/${albumId}/${id}${extension}`;
    const originalUrl = publicObjectUrl(originalKey);

    return {
      id,
      originalKey,
      originalUrl,
      previewUrl: originalUrl,
      thumbnailUrl: originalUrl,
      uploadUrl: client.signatureUrl(originalKey, {
        expires: 15 * 60,
        method: "PUT",
        "Content-Type": mimeType
      }),
      mimeType,
      size: file.size,
      filename: file.name
    };
  });
}

export function publicObjectUrl(objectKey: string) {
  const publicBase = process.env.ALI_OSS_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  const base = publicBase || `https://${OSS_BUCKET}.${OSS_ENDPOINT}`;
  return `${base}/${encodeObjectKey(objectKey)}`;
}

export function imageProcessUrl(objectKey: string, process: string) {
  return `${publicObjectUrl(objectKey)}?x-oss-process=${encodeURIComponent(process)}`;
}

export async function uploadBufferToOss({
  key,
  buffer,
  mimeType
}: {
  key: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const client = createOssClient();
  await client.put(key, buffer, {
    mime: mimeType,
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
  return publicObjectUrl(key);
}

export async function deleteOssObjects(keys: Array<string | null | undefined>) {
  const uniqueKeys = Array.from(new Set(keys.filter((key): key is string => Boolean(key && !key.startsWith("http")))));
  if (!uniqueKeys.length || !isOssConfigured()) {
    return;
  }

  const client = createOssClient();
  await client.deleteMulti(uniqueKeys).catch(() => undefined);
}

export function normalizedImageExtension(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

export function normalizeMimeType(mimeType: string | undefined, extension: string) {
  if (mimeType?.startsWith("image/")) {
    return mimeType;
  }

  return DEFAULT_MIME_TYPES[extension] ?? "application/octet-stream";
}

export function safeOssObjectKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const key = value.trim();
  if (!key || key.startsWith("/") || key.includes("..") || /^https?:\/\//i.test(key)) {
    return null;
  }

  return key;
}

function encodeObjectKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function stripProtocol(value: string) {
  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function normalizeRegion(value: string) {
  return value.startsWith("oss-") ? value : `oss-${value}`;
}

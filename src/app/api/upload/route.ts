import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { cameras } from "@/lib/catalog";
import {
  deleteOssObjects,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  publicObjectUrl,
  safeOssObjectKey
} from "@/lib/oss";
import { normalizeRotation, type Rotation } from "@/lib/rotation";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadRecord = {
  id: string;
  user_id: string;
  album_id: string;
  title: string;
  original_path: string;
  preview_path: string;
  thumbnail_path: string;
  image_path: string;
  original_url: string;
  preview_url: string;
  thumbnail_url: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  width?: number;
  height?: number;
  camera?: string;
  camera_type?: "135" | "120" | "digital";
  lens?: string;
  film?: string;
  film_brand?: string;
  iso?: number;
  aperture?: string;
  shutter_speed?: string;
  focal_length?: string;
  taken_at?: string;
  location?: string;
  scanner?: string;
  notes?: string;
  rotation: Rotation;
  visibility: "public";
};

type UploadMetadata = {
  albumTitle?: string;
  camera?: string;
  lens?: string;
  film?: string;
  iso?: string;
  takenAt?: string;
  location?: string;
  notes?: string;
};

const completedFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(260),
  originalKey: z.string().min(1).max(1024),
  size: z.number().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().min(1).max(120),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  rotation: z.number().optional()
});

const uploadCompleteSchema = z.object({
  albumId: z.string().uuid(),
  coverFileIndex: z.number().int().min(0).max(MAX_UPLOAD_FILES - 1).optional(),
  metadata: z
    .object({
      albumTitle: z.string().optional(),
      camera: z.string().optional(),
      lens: z.string().optional(),
      film: z.string().optional(),
      iso: z.string().optional(),
      takenAt: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional()
    })
    .optional(),
  files: z.array(completedFileSchema).min(1).max(MAX_UPLOAD_FILES)
});

export async function POST(request: NextRequest) {
  const user = getAppSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "请先登录后再上传。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "请先配置 Supabase，照片信息需要写入数据库。" }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "上传完成信息无效。" }, { status: 400 });
  }

  try {
    await ensureProfile(supabase, user);

    const metadata = normalizeMetadata(parsed.data.metadata);
    const createdAt = new Date().toISOString();
    const albumTitle = readAlbumTitle(metadata, user.displayName || user.username);
    const records = parsed.data.files.map((file) =>
      createUploadRecord({
        albumId: parsed.data.albumId,
        file,
        metadata,
        userId: user.id,
        createdAt
      })
    );

    const cover = records[parsed.data.coverFileIndex ?? 0] ?? records[0];
    const albumPayload = {
      id: parsed.data.albumId,
      user_id: user.id,
      title: albumTitle,
      description: metadata.notes ?? "",
      cover_path: cover.original_url,
      cover_photo_id: cover.id,
      location: metadata.location,
      date: cover.taken_at?.slice(0, 10),
      visibility: "public"
    };

    await upsertAlbumSafely(supabase, albumPayload);
    const warning = await insertPhotosWithSchemaFallback(supabase, records);

    return NextResponse.json({
      uploaded: records.length,
      albumId: parsed.data.albumId,
      urls: records.map((record) => record.original_url),
      warning
    });
  } catch (error) {
    await cleanupFailedUpload(supabase, parsed.data.albumId, parsed.data.files.map((file) => file.originalKey));

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传入库失败。" },
      { status: 400 }
    );
  }
}

async function ensureProfile(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  user: NonNullable<ReturnType<typeof getAppSessionFromRequest>>
) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: user.username,
      display_name: user.displayName || user.username,
      avatar_url: user.avatarUrl
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function createUploadRecord({
  albumId,
  file,
  metadata,
  userId,
  createdAt
}: {
  albumId: string;
  file: z.infer<typeof completedFileSchema>;
  metadata: UploadMetadata;
  userId: string;
  createdAt: string;
}): UploadRecord {
  const originalKey = safeOssObjectKey(file.originalKey);
  if (!originalKey || !originalKey.startsWith(`originals/${userId}/`) || !originalKey.includes(`/${albumId}/`)) {
    throw new Error(`${file.name} 的 OSS 对象路径无效。`);
  }

  const camera = metadata.camera;
  const film = metadata.film;
  const takenAt = normalizeDateInput(metadata.takenAt);

  return {
    id: file.id,
    user_id: userId,
    album_id: albumId,
    title: filenameTitle(file.name),
    original_path: originalKey,
    preview_path: originalKey,
    thumbnail_path: originalKey,
    image_path: originalKey,
    original_url: publicObjectUrl(originalKey),
    preview_url: publicObjectUrl(originalKey),
    thumbnail_url: publicObjectUrl(originalKey),
    file_size: file.size,
    mime_type: file.mimeType,
    uploaded_at: createdAt,
    width: file.width,
    height: file.height,
    camera,
    camera_type: inferCameraType(camera),
    lens: metadata.lens,
    film,
    film_brand: film ? film.split(" ")[0] : undefined,
    iso: readNumber(metadata.iso),
    taken_at: takenAt,
    location: metadata.location,
    notes: metadata.notes,
    rotation: normalizeRotation(file.rotation),
    visibility: "public"
  };
}

async function upsertAlbumSafely(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, payload: Record<string, unknown>) {
  let nextPayload = stripUndefinedValues(payload);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { error } = await supabase.from("albums").upsert(nextPayload);
    if (!error) return;

    const missingColumn = extractMissingAlbumColumn(error.message);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      throw new Error(error.message);
    }

    const fallbackPayload = { ...nextPayload };
    delete fallbackPayload[missingColumn];
    nextPayload = fallbackPayload;
  }

  throw new Error("数据库 albums 表缺少过多字段，请重新执行 supabase/schema.sql。");
}

async function insertPhotosWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  records: UploadRecord[]
) {
  let insertRecords = records.map(stripUndefinedValues);
  let warning: string | null = null;
  const requiredColumns = new Set([
    "id",
    "user_id",
    "title",
    "original_path",
    "preview_path",
    "thumbnail_path",
    "visibility"
  ]);

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const { error } = await supabase.from("photos").insert(insertRecords);
    if (!error) return warning;

    const missingColumn = extractMissingPhotoColumn(error.message);
    if (!missingColumn || requiredColumns.has(missingColumn)) {
      throw new Error(error.message);
    }

    if (missingColumn === "rotation") {
      warning = "数据库 photos 表还没有 rotation 字段，请重新执行 supabase/schema.sql 后再保存旋转。";
    }

    insertRecords = insertRecords.map((record) => {
      const nextRecord = { ...record };
      delete nextRecord[missingColumn];
      return nextRecord;
    });
  }

  throw new Error("数据库 photos 表缺少过多字段，请重新执行 supabase/schema.sql。");
}

async function cleanupFailedUpload(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  objectKeys: string[]
) {
  await deleteOssObjects(objectKeys);
  await supabase.from("photos").delete().eq("album_id", albumId);
  await supabase.from("albums").delete().eq("id", albumId);
}

function normalizeMetadata(metadata?: UploadMetadata) {
  return {
    albumTitle: cleanText(metadata?.albumTitle),
    camera: cleanText(metadata?.camera),
    lens: cleanText(metadata?.lens),
    film: cleanText(metadata?.film),
    iso: cleanText(metadata?.iso),
    takenAt: cleanText(metadata?.takenAt),
    location: cleanText(metadata?.location),
    notes: cleanText(metadata?.notes)
  };
}

function cleanText(value?: string) {
  const text = value?.trim();
  return text || undefined;
}

function readAlbumTitle(metadata: UploadMetadata, fallbackTitle: string) {
  return metadata.albumTitle?.trim() || fallbackTitle || "Film User";
}

function normalizeDateInput(value?: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readNumber(value?: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function filenameTitle(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ");
}

function inferCameraType(camera?: string): UploadRecord["camera_type"] {
  if (!camera) {
    return undefined;
  }

  const normalized = camera.toLowerCase();
  const match = cameras.find((item) => `${item.brand} ${item.model}`.toLowerCase() === normalized);
  if (!match) {
    return undefined;
  }

  if (match.type === "135胶片机") return "135";
  if (match.type === "120胶片机") return "120";
  return "digital";
}

function stripUndefinedValues(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function extractMissingPhotoColumn(message: string) {
  return (
    message.match(/'([^']+)' column of 'photos'/i)?.[1] ??
    message.match(/column "([^"]+)" of relation "photos"/i)?.[1] ??
    null
  );
}

function extractMissingAlbumColumn(message: string) {
  return (
    message.match(/'([^']+)' column of 'albums'/i)?.[1] ??
    message.match(/column "([^"]+)" of relation "albums"/i)?.[1] ??
    null
  );
}

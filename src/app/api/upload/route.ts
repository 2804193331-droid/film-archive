import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";
import sharp from "sharp";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { cameras } from "@/lib/catalog";
import {
  appendLocalAlbumWithPhotos,
  type LocalAlbumRecord,
  type LocalPhotoRecord
} from "@/lib/local-library";
import { createSupabaseAdminClient, getUserFromBearerToken } from "@/lib/supabase";
import { ensureStorageStructure, getConfiguredUploadDir, getStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 120 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

type UploadRecord = Omit<LocalPhotoRecord, "created_at" | "uploader"> & {
  visibility: "public";
};

export async function POST(request: NextRequest) {
  const status = await getStorageStatus();
  if (!status.configured || !status.online || status.readOnly) {
    return NextResponse.json({ error: "照片存储硬盘未连接或不可写。" }, { status: 423 });
  }

  const bearerUser = await getUserFromBearerToken(request.headers.get("authorization"));
  const cookieUser = getAppSessionFromRequest(request);
  const user = bearerUser
    ? {
        id: bearerUser.id,
        username: bearerUser.user_metadata?.username ?? bearerUser.email?.split("@")[0] ?? "user",
        displayName:
          bearerUser.user_metadata?.display_name ??
          bearerUser.user_metadata?.username ??
          bearerUser.email?.split("@")[0] ??
          "Film User",
        avatarUrl: bearerUser.user_metadata?.avatar_url
      }
    : cookieUser;

  if (!user) {
    return NextResponse.json({ error: "请先登录后再上传。" }, { status: 401 });
  }

  const uploadDir = await getConfiguredUploadDir();
  if (!uploadDir) {
    return NextResponse.json({ error: "存储目录未配置。" }, { status: 503 });
  }

  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "没有收到照片文件。" }, { status: 400 });
  }

  await ensureStorageStructure(uploadDir);

  try {
    const albumId = randomUUID();
    const albumTitle = readAlbumTitle(form, user.displayName || user.username);
    const records: UploadRecord[] = [];

    for (const file of files) {
      records.push(
        await processFile({
          file,
          form,
          uploadDir,
          userId: user.id,
          albumId,
          filesCount: files.length
        })
      );
    }

    const createdAt = new Date().toISOString();
    const album = createLocalAlbum({
      id: albumId,
      title: albumTitle,
      form,
      records,
      user,
      createdAt
    });

    await appendLocalAlbumWithPhotos(
      uploadDir,
      album,
      records.map(
        (record): LocalPhotoRecord => ({
          ...record,
          created_at: createdAt,
          uploader: user
        })
      )
    );

    const supabase = createSupabaseAdminClient();
    let databaseSynced = false;
    let warning: string | undefined;

    if (supabase) {
      try {
        const albumSynced = await upsertAlbumSafely({
          album,
          supabase
        });
        await upsertSeriesSafely({
          album,
          supabase
        });
        await insertPhotosWithSchemaFallback(
          supabase,
          albumSynced ? records : records.map(removeAlbumId)
        );
        await insertSeriesPhotosSafely(supabase, album.id, records);
        databaseSynced = true;
      } catch (error) {
        warning =
          error instanceof Error
            ? `Supabase 同步失败，已保存到本地索引：${error.message}`
            : "Supabase 同步失败，已保存到本地索引。";
      }
    } else {
      warning = "Supabase Service Role 未配置，已保存到本地索引。";
    }

    return NextResponse.json({
      uploaded: records.length,
      albumId,
      databaseSynced,
      warning
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "上传处理失败。" },
      { status: 400 }
    );
  }
}

async function processFile({
  file,
  form,
  uploadDir,
  userId,
  albumId,
  filesCount
}: {
  file: File;
  form: FormData;
  uploadDir: string;
  userId: string;
  albumId: string;
  filesCount: number;
}): Promise<UploadRecord> {
  const extension = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`${file.name} 格式不支持。`);
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} 超过 120MB 服务端限制。`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = randomUUID();
  const originalPath = `${year}/${month}/${id}${extension}`;
  const previewPath = `${year}/${month}/${id}.jpg`;
  const thumbnailPath = `${year}/${month}/${id}.jpg`;

  await Promise.all(
    ["originals", "previews", "thumbnails", "backup"].map((kind) =>
      fs.mkdir(path.join(uploadDir, kind, year, month), { recursive: true })
    )
  );

  const originalFile = path.join(uploadDir, "originals", year, month, `${id}${extension}`);
  const previewFile = path.join(uploadDir, "previews", year, month, `${id}.jpg`);
  const thumbnailFile = path.join(uploadDir, "thumbnails", year, month, `${id}.jpg`);
  const backupFile = path.join(uploadDir, "backup", year, month, `${id}${extension}`);

  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  await Promise.all([
    fs.writeFile(originalFile, buffer),
    fs.writeFile(backupFile, buffer),
    sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 2400, withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toFile(previewFile),
    sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 760, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toFile(thumbnailFile)
  ]);

  const exif = await exifr.parse(buffer).catch(() => null);
  const camera = readFormText(form, "camera") || joinCamera(exif?.Make, exif?.Model);
  const lens = readFormText(form, "lens") || exif?.LensModel || exif?.Lens;
  const film = readFormText(form, "film");
  const title = filesCount === 1 ? readFormText(form, "title") || filenameTitle(file.name) : filenameTitle(file.name);
  const manualTakenAt = normalizeDateInput(readFormText(form, "takenAt"));

  return {
    id,
    user_id: userId,
    album_id: albumId,
    series_id: albumId,
    title,
    original_path: originalPath,
    preview_path: previewPath,
    thumbnail_path: thumbnailPath,
    width: metadata.width,
    height: metadata.height,
    camera: camera || undefined,
    camera_type: inferCameraType(camera),
    lens: lens || undefined,
    film: film || undefined,
    film_brand: film ? film.split(" ")[0] : undefined,
    iso: readFormNumber(form, "iso") ?? readExifNumber(exif?.ISO),
    aperture: readFormText(form, "aperture") || (exif?.FNumber ? `f/${trimNumber(exif.FNumber)}` : undefined),
    shutter_speed: readFormText(form, "shutterSpeed") || formatExposure(exif?.ExposureTime),
    focal_length: readFormText(form, "focalLength") || (exif?.FocalLength ? `${trimNumber(exif.FocalLength)}mm` : undefined),
    taken_at: manualTakenAt || (exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : undefined),
    location: readFormText(form, "location") || undefined,
    scanner: readFormText(form, "scanner") || exif?.Software || undefined,
    notes: readFormText(form, "notes") || undefined,
    visibility: "public"
  };
}

function createLocalAlbum({
  id,
  title,
  form,
  records,
  user,
  createdAt
}: {
  id: string;
  title: string;
  form: FormData;
  records: UploadRecord[];
  user: LocalAlbumRecord["uploader"];
  createdAt: string;
}): LocalAlbumRecord {
  const cover = records[0];

  return {
    id,
    user_id: user.id,
    title,
    description: readFormText(form, "notes") || undefined,
    cover_path: cover.thumbnail_path,
    cover_width: cover.width,
    cover_height: cover.height,
    photo_ids: records.map((record) => record.id),
    photo_count: records.length,
    camera: readFormText(form, "camera") || cover.camera,
    camera_type: cover.camera_type,
    lens: readFormText(form, "lens") || cover.lens,
    film: readFormText(form, "film") || cover.film,
    film_brand: cover.film_brand,
    iso: cover.iso,
    taken_at: cover.taken_at,
    date: cover.taken_at?.slice(0, 10),
    location: readFormText(form, "location") || cover.location,
    visibility: "public",
    created_at: createdAt,
    uploader: user
  };
}

async function upsertAlbumSafely({
  album,
  supabase
}: {
  album: LocalAlbumRecord;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}) {
  const { error } = await supabase.from("albums").upsert({
    id: album.id,
    user_id: album.user_id,
    title: album.title,
    description: album.description ?? "",
    cover_path: album.cover_path,
    location: album.location,
    date: album.date,
    visibility: "public"
  });

  return !error;
}

async function upsertSeriesSafely({
  album,
  supabase
}: {
  album: LocalAlbumRecord;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}) {
  const { error } = await supabase.from("series").upsert({
    id: album.id,
    owner_id: album.user_id,
    title: album.title,
    description: album.description ?? "",
    cover_path: album.cover_path,
    location: album.location,
    date: album.date,
    visibility: "public"
  });

  if (error) {
    throw new Error(error.message);
  }
}

function removeAlbumId(record: UploadRecord) {
  const nextRecord = { ...record };
  delete nextRecord.album_id;
  return nextRecord;
}

async function insertPhotosWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  records: UploadRecord[]
) {
  let insertRecords = records.map(stripUndefinedValues);
  const requiredColumns = new Set([
    "id",
    "user_id",
    "title",
    "original_path",
    "preview_path",
    "thumbnail_path",
    "visibility"
  ]);

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { error } = await supabase.from("photos").insert(insertRecords);
    if (!error) return;

    const missingColumn = extractMissingPhotoColumn(error.message);
    if (!missingColumn || requiredColumns.has(missingColumn)) {
      throw new Error(error.message);
    }

    insertRecords = insertRecords.map((record) => {
      const nextRecord = { ...record };
      delete nextRecord[missingColumn];
      return nextRecord;
    });
  }

  throw new Error("数据库 photos 表缺少过多字段，请重新执行 supabase/schema.sql。");
}

async function insertSeriesPhotosSafely(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  seriesId: string,
  records: UploadRecord[]
) {
  const { error } = await supabase
    .from("series_photos")
    .insert(
      records.map((record, index) => ({
        series_id: seriesId,
        photo_id: record.id,
        position: index + 1
      }))
    );

  if (error) {
    throw new Error(error.message);
  }
}

function stripUndefinedValues(record: UploadRecord) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Record<string, unknown>;
}

function extractMissingPhotoColumn(message: string) {
  return message.match(/'([^']+)' column of 'photos'/i)?.[1] ?? null;
}

function readFormText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readFormNumber(form: FormData, key: string) {
  const value = Number(readFormText(form, key));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readAlbumTitle(form: FormData, fallbackTitle: string) {
  const explicitTitle = readFormText(form, "albumTitle") || readFormText(form, "seriesTitle") || readFormText(form, "title");
  if (explicitTitle) {
    return explicitTitle;
  }

  return fallbackTitle || "Film User";
}

function filenameTitle(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ");
}

function joinCamera(make?: string, model?: string) {
  return [make, model].filter(Boolean).join(" ").trim();
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

function readExifNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function trimNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function formatExposure(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  if (value >= 1) {
    return `${trimNumber(value)}s`;
  }

  return `1/${Math.round(1 / value)}`;
}

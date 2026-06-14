import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";
import sharp from "sharp";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { isAdminUser } from "@/lib/admin";
import { cameras } from "@/lib/catalog";
import {
  assertLocalAlbumEditable,
  deleteLocalAlbum,
  updateLocalAlbum,
  type LocalAlbumUpdate,
  type LocalPhotoRecord
} from "@/lib/local-library";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { ensureStorageStructure, getConfiguredUploadDir, getStorageStatus } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_SIZE = 120 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const status = await getStorageStatus();
  const uploadDir = await getConfiguredUploadDir();
  if (!uploadDir || !status.configured || !status.online || status.readOnly) {
    return NextResponse.json({ error: "照片存储硬盘未连接，当前不能编辑。" }, { status: 423 });
  }

  const { id } = await context.params;
  const isAdmin = isAdminUser(session.id, session.username);

  try {
    const { updates, files } = await readPatchPayload(request, session.displayName || session.username);
    const access = await assertLocalAlbumEditable({
      uploadDir,
      albumId: id,
      userId: session.id,
      isAdmin
    });

    if (access.missing) {
      return NextResponse.json({ error: "没有找到这个作品组。" }, { status: 404 });
    }

    if (files.length) {
      await ensureStorageStructure(uploadDir);
    }

    const createdAt = new Date().toISOString();
    const newPhotos: LocalPhotoRecord[] = [];
    for (const file of files) {
      newPhotos.push(
        await processAdditionalPhoto({
          file,
          uploadDir,
          albumId: id,
          userId: session.id,
          user: {
            id: session.id,
            username: session.username,
            displayName: session.displayName,
            avatarUrl: session.avatarUrl
          },
          updates,
          createdAt
        })
      );
    }

    const result = await updateLocalAlbum({
      uploadDir,
      albumId: id,
      userId: session.id,
      updates,
      newPhotos,
      isAdmin
    });

    if (result.missing) {
      return NextResponse.json({ error: "没有找到这个作品组。" }, { status: 404 });
    }

    const warning = await updateSupabaseAlbum({
      albumId: id,
      userId: session.id,
      updates,
      newPhotos,
      existingPhotoCount: Math.max(0, (result.album?.photoCount ?? newPhotos.length) - newPhotos.length),
      isAdmin
    });

    return NextResponse.json({ ok: true, album: result.album, addedPhotos: newPhotos.length, warning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "编辑失败。" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const status = await getStorageStatus();
  const uploadDir = await getConfiguredUploadDir();
  if (!uploadDir || !status.configured || !status.online || status.readOnly) {
    return NextResponse.json({ error: "照片存储硬盘未连接，当前不能删除。" }, { status: 423 });
  }

  const { id } = await context.params;
  const isAdmin = isAdminUser(session.id, session.username);

  try {
    const result = await deleteLocalAlbum({
      uploadDir,
      albumId: id,
      userId: session.id,
      isAdmin
    });

    if (result.missing) {
      return NextResponse.json({ error: "没有找到这个作品组。" }, { status: 404 });
    }

    await deleteSupabaseAlbum({
      albumId: id,
      userId: session.id,
      isAdmin
    });

    return NextResponse.json({ ok: true, deletedPhotos: result.deletedPhotos });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败。" },
      { status: 400 }
    );
  }
}

async function deleteSupabaseAlbum({
  albumId,
  userId,
  isAdmin
}: {
  albumId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return;
  }

  let photoDelete = supabase.from("photos").delete().eq("series_id", albumId);
  if (!isAdmin) {
    photoDelete = photoDelete.eq("user_id", userId);
  }
  await photoDelete;

  let photoDeleteByAlbum = supabase.from("photos").delete().eq("album_id", albumId);
  if (!isAdmin) {
    photoDeleteByAlbum = photoDeleteByAlbum.eq("user_id", userId);
  }
  await photoDeleteByAlbum;

  let albumDelete = supabase.from("albums").delete().eq("id", albumId);
  if (!isAdmin) {
    albumDelete = albumDelete.eq("user_id", userId);
  }
  await albumDelete;

  let seriesDelete = supabase.from("series").delete().eq("id", albumId);
  if (!isAdmin) {
    seriesDelete = seriesDelete.eq("owner_id", userId);
  }
  await seriesDelete;
}

async function updateSupabaseAlbum({
  albumId,
  userId,
  updates,
  newPhotos,
  existingPhotoCount,
  isAdmin
}: {
  albumId: string;
  userId: string;
  updates: LocalAlbumUpdate;
  newPhotos: LocalPhotoRecord[];
  existingPhotoCount: number;
  isAdmin: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return "Supabase 未配置，已保存到本地索引。";
  }

  const albumPayload = stripUndefinedValues({
    title: updates.title,
    description: updates.notes ?? "",
    location: updates.location,
    date: updates.taken_at?.slice(0, 10)
  });

  const photoPayload = stripUndefinedValues({
    camera: updates.camera,
    lens: updates.lens,
    film: updates.film,
    film_brand: updates.film ? updates.film.split(" ")[0] : undefined,
    iso: updates.iso,
    taken_at: updates.taken_at,
    location: updates.location,
    notes: updates.notes
  });

  try {
    let albumUpdate = supabase.from("albums").update(albumPayload).eq("id", albumId);
    if (!isAdmin) {
      albumUpdate = albumUpdate.eq("user_id", userId);
    }
    await albumUpdate;

    let seriesUpdate = supabase.from("series").update(albumPayload).eq("id", albumId);
    if (!isAdmin) {
      seriesUpdate = seriesUpdate.eq("owner_id", userId);
    }
    await seriesUpdate;

    if (Object.keys(photoPayload).length) {
      let photoUpdate = supabase.from("photos").update(photoPayload).eq("series_id", albumId);
      if (!isAdmin) {
        photoUpdate = photoUpdate.eq("user_id", userId);
      }
      await photoUpdate;

      let photoAlbumUpdate = supabase.from("photos").update(photoPayload).eq("album_id", albumId);
      if (!isAdmin) {
        photoAlbumUpdate = photoAlbumUpdate.eq("user_id", userId);
      }
      await photoAlbumUpdate;
    }

    if (newPhotos.length) {
      await insertPhotosWithSchemaFallback(supabase, newPhotos.map(toSupabasePhotoRecord));
      await insertSeriesPhotosSafely(supabase, albumId, newPhotos, existingPhotoCount);
    }

    return undefined;
  } catch (error) {
    return error instanceof Error ? `Supabase 同步失败，本地已保存：${error.message}` : "Supabase 同步失败，本地已保存。";
  }
}

async function readPatchPayload(request: NextRequest, fallbackTitle: string) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      updates: parseAlbumUpdate(form, fallbackTitle),
      files: form.getAll("files").filter((value): value is File => value instanceof File)
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    updates: parseAlbumUpdate(body, fallbackTitle),
    files: []
  };
}

async function processAdditionalPhoto({
  file,
  uploadDir,
  albumId,
  userId,
  user,
  updates,
  createdAt
}: {
  file: File;
  uploadDir: string;
  albumId: string;
  userId: string;
  user: LocalPhotoRecord["uploader"];
  updates: LocalAlbumUpdate;
  createdAt: string;
}): Promise<LocalPhotoRecord> {
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
  const exif = await exifr.parse(buffer).catch(() => null);
  const camera = updates.camera || joinCamera(exif?.Make, exif?.Model);
  const lens = updates.lens || exif?.LensModel || exif?.Lens;
  const film = updates.film;

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

  return {
    id,
    user_id: userId,
    album_id: albumId,
    series_id: albumId,
    title: filenameTitle(file.name),
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
    iso: updates.iso ?? readExifNumber(exif?.ISO),
    aperture: exif?.FNumber ? `f/${trimNumber(exif.FNumber)}` : undefined,
    shutter_speed: formatExposure(exif?.ExposureTime),
    focal_length: exif?.FocalLength ? `${trimNumber(exif.FocalLength)}mm` : undefined,
    taken_at: updates.taken_at || (exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal.toISOString() : undefined),
    location: updates.location,
    scanner: exif?.Software,
    notes: updates.notes,
    visibility: "public",
    created_at: createdAt,
    uploader: user
  };
}

async function insertPhotosWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  records: Record<string, unknown>[]
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
  records: LocalPhotoRecord[],
  startPosition: number
) {
  const { error } = await supabase
    .from("series_photos")
    .insert(
      records.map((record, index) => ({
        series_id: seriesId,
        photo_id: record.id,
        position: startPosition + index + 1
      }))
    );

  if (error) {
    throw new Error(error.message);
  }
}

function toSupabasePhotoRecord(record: LocalPhotoRecord) {
  const { uploader: _uploader, created_at: _createdAt, ...photoRecord } = record;
  return photoRecord;
}

function extractMissingPhotoColumn(message: string) {
  return message.match(/'([^']+)' column of 'photos'/i)?.[1] ?? null;
}

function parseAlbumUpdate(value: unknown, fallbackTitle = ""): LocalAlbumUpdate {
  const source = value instanceof FormData
    ? Object.fromEntries(value.entries())
    : typeof value === "object" && value
      ? (value as Record<string, unknown>)
      : {};
  const takenAt = normalizeDateInput(readString(source.takenAt));
  const iso = Number(readString(source.iso));
  const title = readString(source.title) || fallbackTitle;

  return {
    title,
    camera: readOptionalString(source.camera),
    lens: readOptionalString(source.lens),
    film: readOptionalString(source.film),
    iso: Number.isFinite(iso) && iso > 0 ? iso : undefined,
    taken_at: takenAt,
    location: readOptionalString(source.location),
    notes: readOptionalString(source.notes)
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const text = readString(value);
  return text || undefined;
}

function normalizeDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function stripUndefinedValues(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function filenameTitle(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ");
}

function joinCamera(make?: string, model?: string) {
  return [make, model].filter(Boolean).join(" ").trim();
}

function inferCameraType(camera?: string): LocalPhotoRecord["camera_type"] {
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

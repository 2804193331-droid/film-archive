import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { canAccessAdmin } from "@/lib/admin";
import { cameras } from "@/lib/catalog";
import {
  deleteOssObjects,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  publicObjectUrl,
  safeOssObjectKey
} from "@/lib/oss";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AlbumUpdate = {
  title: string;
  camera?: string;
  lens?: string;
  film?: string;
  iso?: number;
  taken_at?: string;
  location?: string;
  notes?: string;
};

type PhotoInsert = {
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
  taken_at?: string;
  location?: string;
  notes?: string;
  visibility: "public";
};

const uploadedFileSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(260),
  originalKey: z.string().min(1).max(1024),
  size: z.number().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().min(1).max(120),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

const patchSchema = z.object({
  title: z.string().optional(),
  camera: z.string().optional(),
  lens: z.string().optional(),
  film: z.string().optional(),
  iso: z.string().optional(),
  takenAt: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  files: z.array(uploadedFileSchema).max(MAX_UPLOAD_FILES).optional()
    .default([]),
  coverPhotoId: z.string().uuid().nullable().optional(),
  deletePhotoIds: z.array(z.string().uuid()).max(MAX_UPLOAD_FILES).optional().default([]),
  replacePhotos: z
    .array(
      z.object({
        photoId: z.string().uuid(),
        file: uploadedFileSchema
      })
    )
    .max(MAX_UPLOAD_FILES)
    .optional()
    .default([])
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "请先配置 Supabase。" }, { status: 503 });
  }

  const { id } = await context.params;
  const body = await readPatchPayload(request);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "编辑信息无效。" }, { status: 400 });
  }

  const isAdmin = canAccessAdmin(session);

  try {
    await ensureProfile(supabase, session);

    const existing = await getEditableAlbum(supabase, id, session.id, isAdmin);
    if (!existing) {
      return NextResponse.json({ error: "没有找到这个作品组。" }, { status: 404 });
    }

    const updates = parseAlbumUpdate(parsed.data, session.displayName || session.username);
    const albumPayload = stripUndefinedValues({
      title: updates.title,
      description: updates.notes ?? "",
      location: updates.location,
      date: updates.taken_at?.slice(0, 10)
    });

    let albumUpdate = supabase.from("albums").update(albumPayload).eq("id", id);
    if (!isAdmin) albumUpdate = albumUpdate.eq("user_id", session.id);
    await albumUpdate;

    const photoPayload = stripUndefinedValues({
      camera: updates.camera,
      camera_type: inferCameraType(updates.camera),
      lens: updates.lens,
      film: updates.film,
      film_brand: updates.film ? updates.film.split(" ")[0] : undefined,
      iso: updates.iso,
      taken_at: updates.taken_at,
      location: updates.location,
      notes: updates.notes
    });

    if (Object.keys(photoPayload).length) {
      let photoUpdate = supabase.from("photos").update(photoPayload).eq("album_id", id);
      if (!isAdmin) photoUpdate = photoUpdate.eq("user_id", session.id);
      await photoUpdate;
    }

    const createdAt = new Date().toISOString();
    const newPhotos = parsed.data.files.map((file) =>
      createPhotoInsert({
        albumId: id,
        file,
        updates,
        userId: session.id,
        createdAt
      })
    );

    if (newPhotos.length) {
      await insertPhotosWithSchemaFallback(supabase, newPhotos);
    }

    if (parsed.data.replacePhotos.length) {
      await replacePhotosInAlbum(supabase, {
        albumId: id,
        replacements: parsed.data.replacePhotos,
        updates,
        userId: session.id,
        isAdmin
      });
    }

    if (parsed.data.deletePhotoIds.length) {
      await deletePhotosFromAlbum(supabase, id, parsed.data.deletePhotoIds, session.id, isAdmin);
    }

    if (parsed.data.coverPhotoId !== undefined) {
      await setAlbumCoverByPhotoId(supabase, id, parsed.data.coverPhotoId, session.id, isAdmin);
    } else {
      await ensureAlbumHasCover(supabase, id, session.id, isAdmin);
    }

    return NextResponse.json({ ok: true, addedPhotos: newPhotos.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "编辑失败。" },
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

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = getAppSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "请先配置 Supabase。" }, { status: 503 });
  }

  const { id } = await context.params;
  const isAdmin = canAccessAdmin(session);

  try {
    const existing = await getEditableAlbum(supabase, id, session.id, isAdmin);
    if (!existing) {
      return NextResponse.json({ error: "没有找到这个作品组。" }, { status: 404 });
    }

    const { data: photos } = await supabase
      .from("photos")
      .select("id,original_path")
      .eq("album_id", id);

    const photoIds = (photos ?? []).map((photo: { id: string }) => photo.id);
    await deleteOssObjects((photos ?? []).map((photo: { original_path?: string }) => photo.original_path));

    if (photoIds.length) {
      let photoDelete = supabase.from("photos").delete().in("id", photoIds);
      if (!isAdmin) photoDelete = photoDelete.eq("user_id", session.id);
      await photoDelete;
    }

    let albumDelete = supabase.from("albums").delete().eq("id", id);
    if (!isAdmin) albumDelete = albumDelete.eq("user_id", session.id);
    await albumDelete;

    return NextResponse.json({ ok: true, deletedPhotos: photoIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "删除失败。" },
      { status: 400 }
    );
  }
}

async function readPatchPayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  return request.json().catch(() => ({}));
}

async function getEditableAlbum(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  userId: string,
  isAdmin: boolean
) {
  let query = supabase
    .from("albums")
    .select("id,user_id")
    .eq("id", albumId);

  if (!isAdmin) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("album_id", albumId);

  return {
    id: data.id as string,
    ownerId: data.user_id as string,
    photoCount: count ?? 0
  };
}

function createPhotoInsert({
  albumId,
  file,
  updates,
  userId,
  createdAt
}: {
  albumId: string;
  file: z.infer<typeof uploadedFileSchema>;
  updates: AlbumUpdate;
  userId: string;
  createdAt: string;
}): PhotoInsert {
  const originalKey = safeOssObjectKey(file.originalKey);
  if (!originalKey || !originalKey.startsWith(`originals/${userId}/`) || !originalKey.includes(`/${albumId}/`)) {
    throw new Error(`${file.name} 的 OSS 对象路径无效。`);
  }

  const film = updates.film;

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
    camera: updates.camera,
    camera_type: inferCameraType(updates.camera),
    lens: updates.lens,
    film,
    film_brand: film ? film.split(" ")[0] : undefined,
    iso: updates.iso,
    taken_at: updates.taken_at,
    location: updates.location,
    notes: updates.notes,
    visibility: "public"
  };
}

async function insertPhotosWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  records: PhotoInsert[]
) {
  let insertRecords = records.map(stripUndefinedValues);
  const requiredColumns = new Set(["id", "user_id", "title", "original_path", "preview_path", "thumbnail_path", "visibility"]);

  for (let attempt = 0; attempt < 32; attempt += 1) {
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

async function replacePhotosInAlbum(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  {
    albumId,
    replacements,
    updates,
    userId,
    isAdmin
  }: {
    albumId: string;
    replacements: Array<{ photoId: string; file: z.infer<typeof uploadedFileSchema> }>;
    updates: AlbumUpdate;
    userId: string;
    isAdmin: boolean;
  }
) {
  const ids = replacements.map((item) => item.photoId);
  let query = supabase.from("photos").select("id,original_path").eq("album_id", albumId).in("id", ids);
  if (!isAdmin) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const existingById = new Map((data ?? []).map((item: any) => [item.id as string, item]));
  const oldKeys: string[] = [];

  for (const replacement of replacements) {
    const existing = existingById.get(replacement.photoId);
    if (!existing) {
      throw new Error("要替换的照片不属于这个摄影组。");
    }

    await updatePhotoWithSchemaFallback(
      supabase,
      stripUndefinedValues(createPhotoFileUpdate(replacement.file, updates, userId, albumId)),
      replacement.photoId,
      albumId,
      userId,
      isAdmin
    );

    if (typeof existing.original_path === "string") {
      oldKeys.push(existing.original_path);
    }
  }

  await deleteOssObjects(oldKeys);
}

async function updatePhotoWithSchemaFallback(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  payload: Record<string, unknown>,
  photoId: string,
  albumId: string,
  userId: string,
  isAdmin: boolean
) {
  let nextPayload = payload;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    let update = supabase.from("photos").update(nextPayload).eq("id", photoId).eq("album_id", albumId);
    if (!isAdmin) update = update.eq("user_id", userId);

    const { error } = await update;
    if (!error) return;

    const missingColumn = extractMissingPhotoColumn(error.message);
    if (!missingColumn || !(missingColumn in nextPayload)) {
      throw new Error(error.message);
    }

    const fallbackPayload = { ...nextPayload };
    delete fallbackPayload[missingColumn];
    nextPayload = fallbackPayload;
  }

  throw new Error("数据库 photos 表缺少过多字段，请重新执行 supabase/schema.sql。");
}

async function deletePhotosFromAlbum(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  photoIds: string[],
  userId: string,
  isAdmin: boolean
) {
  const uniqueIds = Array.from(new Set(photoIds));
  if (!uniqueIds.length) return;

  let query = supabase.from("photos").select("id,original_path").eq("album_id", albumId).in("id", uniqueIds);
  if (!isAdmin) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    return;
  }

  let deleteQuery = supabase.from("photos").delete().eq("album_id", albumId).in("id", data.map((photo: any) => photo.id));
  if (!isAdmin) deleteQuery = deleteQuery.eq("user_id", userId);

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  await deleteOssObjects(data.map((photo: any) => photo.original_path));
}

async function setAlbumCoverByPhotoId(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  photoId: string | null | undefined,
  userId: string,
  isAdmin: boolean
) {
  if (!photoId) {
    await ensureAlbumHasCover(supabase, albumId, userId, isAdmin);
    return;
  }

  let query = supabase
    .from("photos")
    .select("id,original_url,original_path")
    .eq("id", photoId)
    .eq("album_id", albumId);

  if (!isAdmin) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    throw new Error("封面照片不属于这个摄影组。");
  }

  await updateAlbumCover(supabase, albumId, photoUrl(data), data.id, userId, isAdmin);
}

async function ensureAlbumHasCover(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  userId: string,
  isAdmin: boolean
) {
  const currentCoverId = await readAlbumCoverPhotoId(supabase, albumId);
  if (currentCoverId) {
    let currentQuery = supabase
      .from("photos")
      .select("id,original_url,original_path")
      .eq("id", currentCoverId)
      .eq("album_id", albumId);
    if (!isAdmin) currentQuery = currentQuery.eq("user_id", userId);

    const { data: current } = await currentQuery.maybeSingle();
    if (current) {
      await updateAlbumCover(supabase, albumId, photoUrl(current), current.id, userId, isAdmin);
      return;
    }
  }

  let firstQuery = supabase
    .from("photos")
    .select("id,original_url,original_path")
    .eq("album_id", albumId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (!isAdmin) firstQuery = firstQuery.eq("user_id", userId);

  const { data: remainingPhotos } = await firstQuery;
  const firstPhoto = remainingPhotos?.[0];
  await updateAlbumCover(supabase, albumId, firstPhoto ? photoUrl(firstPhoto) : null, firstPhoto?.id ?? null, userId, isAdmin);
}

async function readAlbumCoverPhotoId(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, albumId: string) {
  const { data, error } = await supabase.from("albums").select("cover_photo_id").eq("id", albumId).maybeSingle();
  if (error || !data) {
    return null;
  }

  return typeof data.cover_photo_id === "string" ? data.cover_photo_id : null;
}

async function updateAlbumCover(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  coverPath: string | null,
  coverPhotoId: string | null,
  userId: string,
  isAdmin: boolean
) {
  let payload: Record<string, unknown> = {
    cover_path: coverPath,
    cover_photo_id: coverPhotoId
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let update = supabase.from("albums").update(payload).eq("id", albumId);
    if (!isAdmin) update = update.eq("user_id", userId);
    const { error } = await update;
    if (!error) return;

    const missingColumn = extractMissingAlbumColumn(error.message);
    if (!missingColumn || !(missingColumn in payload)) {
      throw new Error(error.message);
    }

    const nextPayload = { ...payload };
    delete nextPayload[missingColumn];
    payload = nextPayload;
  }

  throw new Error("数据库 albums 表缺少封面字段，请重新执行 supabase/schema.sql。");
}

function createPhotoFileUpdate(
  file: z.infer<typeof uploadedFileSchema>,
  updates: AlbumUpdate,
  userId: string,
  albumId: string
) {
  const originalKey = safeOssObjectKey(file.originalKey);
  if (!originalKey || !originalKey.startsWith(`originals/${userId}/`) || !originalKey.includes(`/${albumId}/`)) {
    throw new Error(`${file.name} 的 OSS 对象路径无效。`);
  }

  const originalUrl = publicObjectUrl(originalKey);

  return {
    title: filenameTitle(file.name),
    original_path: originalKey,
    preview_path: originalKey,
    thumbnail_path: originalKey,
    image_path: originalKey,
    original_url: originalUrl,
    preview_url: originalUrl,
    thumbnail_url: originalUrl,
    file_size: file.size,
    mime_type: file.mimeType,
    uploaded_at: new Date().toISOString(),
    width: file.width,
    height: file.height,
    camera: updates.camera,
    camera_type: inferCameraType(updates.camera),
    lens: updates.lens,
    film: updates.film,
    film_brand: updates.film ? updates.film.split(" ")[0] : undefined,
    iso: updates.iso,
    taken_at: updates.taken_at,
    location: updates.location,
    notes: updates.notes,
    visibility: "public"
  };
}

function photoUrl(photo: { original_url?: string | null; original_path?: string | null }) {
  return photo.original_url || (photo.original_path ? publicObjectUrl(photo.original_path) : null);
}

function parseAlbumUpdate(value: z.infer<typeof patchSchema>, fallbackTitle = ""): AlbumUpdate {
  const takenAt = normalizeDateInput(value.takenAt);
  const iso = Number(readString(value.iso));
  const title = readString(value.title) || fallbackTitle;

  return {
    title,
    camera: readOptionalString(value.camera),
    lens: readOptionalString(value.lens),
    film: readOptionalString(value.film),
    iso: Number.isFinite(iso) && iso > 0 ? iso : undefined,
    taken_at: takenAt,
    location: readOptionalString(value.location),
    notes: readOptionalString(value.notes)
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(value: unknown) {
  const text = readString(value);
  return text || undefined;
}

function normalizeDateInput(value?: string) {
  const text = readString(value);
  if (!text) {
    return undefined;
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function filenameTitle(filename: string) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ");
}

function inferCameraType(camera?: string): PhotoInsert["camera_type"] {
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

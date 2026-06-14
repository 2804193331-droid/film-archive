import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAppSessionFromRequest } from "@/lib/app-session";
import { isAdminUser } from "@/lib/admin";
import { cameras } from "@/lib/catalog";
import {
  deleteOssObjects,
  imageProcessUrl,
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

  const isAdmin = isAdminUser(session.id, session.username);

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

    const files = parsed.data.files ?? [];
    const createdAt = new Date().toISOString();
    const newPhotos = files.map((file) =>
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
      await updateCoverIfMissing(supabase, id, newPhotos[0].thumbnail_url, session.id, isAdmin);
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
  const isAdmin = isAdminUser(session.id, session.username);

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
    preview_url: imageProcessUrl(originalKey, "image/resize,w_2400/quality,q_86/format,jpg"),
    thumbnail_url: imageProcessUrl(originalKey, "image/resize,w_760/quality,q_78/format,jpg"),
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

async function updateCoverIfMissing(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  albumId: string,
  coverUrl: string,
  userId: string,
  isAdmin: boolean
) {
  let albumUpdate = supabase.from("albums").update({ cover_path: coverUrl }).eq("id", albumId).is("cover_path", null);
  if (!isAdmin) albumUpdate = albumUpdate.eq("user_id", userId);
  await albumUpdate;
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
  return message.match(/'([^']+)' column of 'photos'/i)?.[1] ?? null;
}

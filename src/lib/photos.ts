import { demoAlbums, demoPhotos, demoUsers } from "@/lib/demo-data";
import { imageProcessUrl, publicObjectUrl } from "@/lib/oss";
import { createSupabaseAdminClient } from "@/lib/supabase";
import type { Album, Photo, Uploader } from "@/lib/types";

export type ArchiveFilters = {
  q?: string;
  film?: string;
  camera?: string;
  lens?: string;
  iso?: string;
  cameraType?: string;
  filmBrand?: string;
  lensBrand?: string;
};

export async function getPhotos(filters: ArchiveFilters = {}) {
  const supabasePhotos = await getSupabasePhotos(filters);
  return filterPhotos(dedupePhotos(supabasePhotos), filters);
}

export async function getPhoto(id: string) {
  const photos = await getPhotos();
  return photos.find((photo) => photo.id === id) ?? demoPhotos.find((photo) => photo.id === id) ?? null;
}

export async function getAlbums(filters: ArchiveFilters = {}) {
  const supabaseAlbums = await getSupabaseAlbums();
  return filterAlbums(dedupeAlbums(supabaseAlbums), filters);
}

export async function getAlbum(id: string) {
  return (await getAlbums()).find((album) => album.id === id) ?? demoAlbums.find((album) => album.id === id) ?? null;
}

export async function getAlbumPhotos(id: string) {
  const photos = await getPhotos();
  return photos.filter((photo) => photo.albumId === id);
}

export async function getAlbumsForUser(userId: string, filters: ArchiveFilters = {}) {
  const albums = await getAlbums(filters);
  return albums.filter((album) => album.userId === userId);
}

export async function getSeriesList(filters: ArchiveFilters = {}) {
  return getAlbums(filters);
}

export async function getSeries(id: string) {
  return getAlbum(id);
}

export async function getUser(idOrUsername: string) {
  const key = decodeURIComponent(idOrUsername).trim();
  const [albums, photos] = await Promise.all([getAlbums(), getPhotos()]);
  const users = [...albums.map((album) => album.owner), ...photos.map((photo) => photo.uploader), ...demoUsers];

  return (
    users.find((user) => user.id === key || user.username === key) ?? {
      id: key,
      username: key,
      displayName: key
    }
  );
}

async function getSupabasePhotos(filters: ArchiveFilters = {}) {
  const supabase = createSupabaseAdminClient();
  let supabasePhotos: Photo[] = [];

  if (!supabase) {
    return supabasePhotos;
  }

  const excludedColumns = new Set<string>();

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const query = supabase
      .from("photos")
      .select(buildPhotoSelect(excludedColumns))
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (filters.q) {
      query.or(
        `title.ilike.%${filters.q}%,location.ilike.%${filters.q}%,camera.ilike.%${filters.q}%,lens.ilike.%${filters.q}%,film.ilike.%${filters.q}%`
      );
    }

    if (filters.cameraType) {
      query.eq("camera_type", filters.cameraType);
    }

    if (filters.filmBrand) {
      query.eq("film_brand", filters.filmBrand);
    }

    if (filters.iso) {
      query.eq("iso", Number(filters.iso));
    }

    const { data, error } = await query;
    if (!error) {
      supabasePhotos = (data ?? []).map(mapSupabasePhoto);
      break;
    }

    const missingColumn = extractMissingPhotoColumn(error.message);
    if (!missingColumn) {
      break;
    }

    excludedColumns.add(missingColumn);
  }

  return supabasePhotos;
}

async function getSupabaseAlbums() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("albums")
    .select("id,user_id,title,description,cover_path,location,date,visibility,created_at,profiles:user_id(id,username,display_name,avatar_url)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error || !data?.length) {
    return [];
  }

  const photos = await getSupabasePhotos();
  const photosByAlbum = groupPhotosByAlbum(photos);

  return data.map((item): Album => {
    const owner = normalizeProfile(item.profiles);
    const albumPhotos = photosByAlbum.get(item.id) ?? [];
    const cover = albumPhotos[0];
    const photoIds = albumPhotos.map((photo) => photo.id);

    return {
      id: item.id,
      userId: item.user_id ?? owner.id,
      title: item.title,
      description: item.description ?? undefined,
      coverUrl: resolveStoredUrl(item.cover_path, "thumbnail") ?? cover?.thumbnailUrl ?? demoAlbums[0].coverUrl,
      coverWidth: cover?.width ?? 1600,
      coverHeight: cover?.height ?? 1200,
      photoCount: photoIds.length || albumPhotos.length,
      photoIds,
      camera: cover?.camera,
      cameraType: cover?.cameraType,
      lens: cover?.lens,
      film: cover?.film,
      filmBrand: cover?.filmBrand,
      iso: cover?.iso,
      takenAt: cover?.takenAt,
      location: item.location ?? cover?.location ?? undefined,
      date: item.date ?? cover?.takenAt?.slice(0, 10) ?? undefined,
      owner,
      visibility: item.visibility ?? "public",
      createdAt: item.created_at ?? new Date().toISOString()
    };
  });
}

function buildPhotoSelect(excludedColumns: Set<string>) {
  const columns = [
    "id",
    "user_id",
    "title",
    "description",
    "original_path",
    "preview_path",
    "thumbnail_path",
    "image_path",
    "original_url",
    "preview_url",
    "thumbnail_url",
    "file_size",
    "mime_type",
    "uploaded_at",
    "width",
    "height",
    "camera",
    "camera_type",
    "lens",
    "film",
    "film_brand",
    "iso",
    "aperture",
    "shutter_speed",
    "focal_length",
    "taken_at",
    "location",
    "scanner",
    "notes",
    "album_id",
    "series_id",
    "visibility",
    "created_at"
  ].filter((column) => !excludedColumns.has(column));

  return [...columns, "profiles:user_id(id,username,display_name,avatar_url)"].join(",");
}

function extractMissingPhotoColumn(message: string) {
  return message.match(/'([^']+)' column of 'photos'/i)?.[1] ?? null;
}

function filterAlbums(albums: Album[], filters: ArchiveFilters) {
  const q = filters.q?.trim().toLowerCase();
  const film = (filters.film ?? filters.filmBrand)?.trim().toLowerCase();
  const camera = filters.camera?.trim().toLowerCase();
  const lens = (filters.lens ?? filters.lensBrand)?.trim().toLowerCase();

  return albums.filter((album) => {
    const matchesQuery = !q
      ? true
      : [album.title, album.location, album.camera, album.lens, album.film, album.owner.displayName, album.owner.username]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
    const matchesFilm = !film || album.film?.toLowerCase().includes(film) || album.filmBrand?.toLowerCase().includes(film);
    const matchesCamera = !camera || album.camera?.toLowerCase().includes(camera);
    const matchesLens = !lens || album.lens?.toLowerCase().includes(lens);
    const matchesIso = !filters.iso || String(album.iso) === filters.iso;

    return matchesQuery && matchesFilm && matchesCamera && matchesLens && matchesIso;
  });
}

function filterPhotos(photos: Photo[], filters: ArchiveFilters) {
  const q = filters.q?.trim().toLowerCase();
  const film = (filters.film ?? filters.filmBrand)?.trim().toLowerCase();
  const camera = filters.camera?.trim().toLowerCase();
  const lens = (filters.lens ?? filters.lensBrand)?.trim().toLowerCase();

  return photos.filter((photo) => {
    const matchesQuery = !q
      ? true
      : [photo.title, photo.location, photo.camera, photo.lens, photo.film, photo.uploader.displayName, photo.uploader.username]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q));
    const matchesFilm = !film || photo.film?.toLowerCase().includes(film) || photo.filmBrand?.toLowerCase().includes(film);
    const matchesCamera = !camera || photo.camera?.toLowerCase().includes(camera);
    const matchesLens = !lens || photo.lens?.toLowerCase().includes(lens);
    const matchesIso = !filters.iso || String(photo.iso) === filters.iso;

    return matchesQuery && matchesFilm && matchesCamera && matchesLens && matchesIso;
  });
}

function dedupePhotos(photos: Photo[]) {
  const seen = new Set<string>();
  return photos.filter((photo) => {
    if (seen.has(photo.id)) {
      return false;
    }
    seen.add(photo.id);
    return true;
  });
}

function dedupeAlbums(albums: Album[]) {
  const seen = new Set<string>();
  return albums.filter((album) => {
    if (seen.has(album.id)) {
      return false;
    }
    seen.add(album.id);
    return true;
  });
}

function groupPhotosByAlbum(photos: Photo[]) {
  const groups = new Map<string, Photo[]>();
  for (const photo of photos) {
    if (!photo.albumId) continue;
    groups.set(photo.albumId, [...(groups.get(photo.albumId) ?? []), photo]);
  }
  return groups;
}

function mapSupabasePhoto(item: any): Photo {
  const uploader = normalizeProfile(item.profiles);
  const objectPath = item.original_path ?? item.image_path;
  const originalUrl = item.original_url ?? resolveStoredUrl(objectPath, "original") ?? demoPhotos[0].originalUrl;
  const previewUrl = item.preview_url ?? resolveStoredUrl(item.preview_path ?? objectPath, "preview") ?? originalUrl;
  const thumbnailUrl = item.thumbnail_url ?? resolveStoredUrl(item.thumbnail_path ?? objectPath, "thumbnail") ?? previewUrl;

  return {
    id: item.id,
    userId: item.user_id ?? uploader.id,
    albumId: item.album_id ?? item.series_id ?? undefined,
    title: item.title,
    description: item.description ?? undefined,
    thumbnailUrl,
    previewUrl,
    originalUrl,
    originalPath: objectPath ?? undefined,
    previewPath: item.preview_path ?? undefined,
    thumbnailPath: item.thumbnail_path ?? undefined,
    fileSize: item.file_size ?? undefined,
    mimeType: item.mime_type ?? undefined,
    uploadedAt: item.uploaded_at ?? undefined,
    width: item.width ?? 1600,
    height: item.height ?? 1200,
    camera: item.camera ?? undefined,
    cameraType: item.camera_type ?? undefined,
    lens: item.lens ?? undefined,
    film: item.film ?? undefined,
    filmBrand: item.film_brand ?? undefined,
    iso: item.iso ?? undefined,
    aperture: item.aperture ?? undefined,
    shutter: item.shutter_speed ?? undefined,
    focalLength: item.focal_length ?? undefined,
    takenAt: item.taken_at ?? undefined,
    location: item.location ?? undefined,
    scanner: item.scanner ?? undefined,
    notes: item.notes ?? undefined,
    uploader,
    visibility: item.visibility ?? "public",
    createdAt: item.created_at ?? new Date().toISOString()
  };
}

function resolveStoredUrl(value: unknown, kind: "original" | "preview" | "thumbnail") {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const text = value.trim();
  if (/^https?:\/\//i.test(text)) {
    return text;
  }

  if (kind === "preview") {
    return imageProcessUrl(text, "image/resize,w_2400/quality,q_86/format,jpg");
  }

  if (kind === "thumbnail") {
    return imageProcessUrl(text, "image/resize,w_760/quality,q_78/format,jpg");
  }

  return publicObjectUrl(text);
}

function normalizeProfile(profile: any): Uploader {
  const value = Array.isArray(profile) ? profile[0] : profile;
  return {
    id: value?.id ?? "unknown",
    username: value?.username ?? "unknown",
    displayName: value?.display_name ?? value?.username ?? "Film User",
    avatarUrl: value?.avatar_url ?? undefined
  };
}

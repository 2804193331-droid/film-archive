import { demoAlbums, demoPhotos, demoUsers } from "@/lib/demo-data";
import { getLocalAlbum, getLocalAlbums, getLocalPhotos, getLocalPhotosByAlbum } from "@/lib/local-library";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getConfiguredUploadDir } from "@/lib/storage";
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
  const uploadDir = await getConfiguredUploadDir();
  const localPhotos = await getLocalPhotos(uploadDir);
  const supabasePhotos = await getSupabasePhotos(filters);
  const realPhotos = dedupePhotos([...localPhotos, ...supabasePhotos]);

  return filterPhotos(realPhotos, filters);
}

export async function getPhoto(id: string) {
  const photos = await getPhotos();
  return photos.find((photo) => photo.id === id) ?? demoPhotos.find((photo) => photo.id === id) ?? null;
}

export async function getAlbums(filters: ArchiveFilters = {}) {
  const uploadDir = await getConfiguredUploadDir();
  const localAlbums = await getLocalAlbums(uploadDir);
  const supabaseAlbums = await getSupabaseAlbums();
  const realAlbums = dedupeAlbums([...localAlbums, ...supabaseAlbums]);

  return filterAlbums(realAlbums, filters);
}

export async function getAlbum(id: string) {
  const uploadDir = await getConfiguredUploadDir();
  return (
    (await getLocalAlbum(uploadDir, id)) ??
    (await getAlbums()).find((album) => album.id === id) ??
    demoAlbums.find((album) => album.id === id) ??
    null
  );
}

export async function getAlbumPhotos(id: string) {
  const uploadDir = await getConfiguredUploadDir();
  const localPhotos = await getLocalPhotosByAlbum(uploadDir, id);
  if (localPhotos.length) {
    return localPhotos;
  }

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
  const users = [
    ...albums.map((album) => album.owner),
    ...photos.map((photo) => photo.uploader),
    ...demoUsers
  ];

  return (
    users.find((user) => user.id === key || user.username === key) ?? {
      id: key,
      username: key,
      displayName: key
    }
  );
}

async function getSupabasePhotos(filters: ArchiveFilters) {
  const supabase = createSupabaseAdminClient();
  let supabasePhotos: Photo[] = [];

  if (!supabase) {
    return supabasePhotos;
  }

  const excludedColumns = new Set<string>();

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const query = supabase
      .from("photos")
      .select(buildPhotoSelect(excludedColumns))
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(120);

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
    if (!error && data?.length) {
      supabasePhotos = data.map(mapSupabasePhoto);
      break;
    }

    const missingColumn = error ? extractMissingPhotoColumn(error.message) : null;
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
    .from("series")
    .select("id,title,description,cover_path,location,date,visibility,created_at,profiles:owner_id(id,username,display_name,avatar_url),series_photos(photo_id)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error || !data?.length) {
    return [];
  }

  return data.map((item): Album => {
    const owner = normalizeProfile(item.profiles);
    const photoIds = Array.isArray(item.series_photos)
      ? item.series_photos.map((entry: { photo_id: string }) => entry.photo_id)
      : [];

    return {
      id: item.id,
      userId: owner.id,
      title: item.title,
      description: item.description ?? undefined,
      coverUrl: item.cover_path ? `/api/assets/thumbnails/${item.cover_path}` : demoAlbums[0].coverUrl,
      coverWidth: 1600,
      coverHeight: 1200,
      photoCount: photoIds.length,
      photoIds,
      location: item.location ?? undefined,
      date: item.date ?? undefined,
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

function mapSupabasePhoto(item: any): Photo {
  const uploader = normalizeProfile(item.profiles);
  return {
    id: item.id,
    userId: item.user_id ?? uploader.id,
    albumId: item.album_id ?? item.series_id ?? undefined,
    title: item.title,
    description: item.description ?? undefined,
    thumbnailUrl: item.thumbnail_path ? `/api/assets/thumbnails/${item.thumbnail_path}` : demoPhotos[0].thumbnailUrl,
    previewUrl: item.preview_path ? `/api/assets/previews/${item.preview_path}` : demoPhotos[0].previewUrl,
    originalUrl: item.original_path ? `/api/assets/originals/${item.original_path}` : demoPhotos[0].originalUrl,
    originalPath: item.original_path ?? undefined,
    previewPath: item.preview_path ?? undefined,
    thumbnailPath: item.thumbnail_path ?? undefined,
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

function normalizeProfile(profile: any): Uploader {
  const value = Array.isArray(profile) ? profile[0] : profile;
  return {
    id: value?.id ?? "unknown",
    username: value?.username ?? "unknown",
    displayName: value?.display_name ?? value?.username ?? "Film User",
    avatarUrl: value?.avatar_url ?? undefined
  };
}

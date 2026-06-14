import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { cameras } from "@/lib/catalog";
import type { Album, Photo, Uploader, Visibility } from "@/lib/types";

const LIBRARY_FILE = ".film-archive-library.json";

export type LocalPhotoRecord = {
  id: string;
  user_id: string;
  album_id?: string;
  title: string;
  description?: string;
  original_path: string;
  preview_path: string;
  thumbnail_path: string;
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
  series_id?: string;
  visibility?: Visibility;
  created_at?: string;
  uploader: Uploader;
};

export type LocalAlbumRecord = {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  cover_path: string;
  cover_width?: number;
  cover_height?: number;
  photo_ids: string[];
  photo_count: number;
  camera?: string;
  camera_type?: "135" | "120" | "digital";
  lens?: string;
  film?: string;
  film_brand?: string;
  iso?: number;
  taken_at?: string;
  date?: string;
  location?: string;
  visibility?: Visibility;
  created_at?: string;
  uploader: Uploader;
};

type LocalLibrary = {
  albums: LocalAlbumRecord[];
  photos: LocalPhotoRecord[];
};

export type LocalAlbumUpdate = {
  title: string;
  camera?: string;
  lens?: string;
  film?: string;
  iso?: number;
  taken_at?: string;
  location?: string;
  notes?: string;
};

export async function appendLocalAlbumWithPhotos(
  uploadDir: string,
  album: LocalAlbumRecord,
  records: LocalPhotoRecord[]
) {
  const library = await readLocalLibrary(uploadDir);
  const existingPhotoIds = new Set(records.map((record) => record.id));
  const nextPhotos = [
    ...records,
    ...library.photos.filter((photo) => !existingPhotoIds.has(photo.id))
  ];
  const nextAlbums = [
    album,
    ...library.albums.filter((item) => item.id !== album.id)
  ];

  await writeLocalLibrary(uploadDir, { albums: nextAlbums, photos: nextPhotos });
}

export async function appendLocalPhotos(uploadDir: string, records: LocalPhotoRecord[]) {
  const library = await readLocalLibrary(uploadDir);
  const existingIds = new Set(library.photos.map((photo) => photo.id));
  const nextPhotos = [
    ...records.filter((record) => !existingIds.has(record.id)),
    ...library.photos
  ];

  await writeLocalLibrary(uploadDir, {
    albums: mergeAlbums(library.albums, deriveAlbumsFromPhotos(nextPhotos)),
    photos: nextPhotos
  });
}

export async function getLocalPhotos(uploadDir: string | null) {
  if (!uploadDir) {
    return [];
  }

  const library = await readLocalLibrary(uploadDir);
  return library.photos.map(mapLocalPhoto);
}

export async function getLocalAlbums(uploadDir: string | null) {
  if (!uploadDir) {
    return [];
  }

  const library = await readLocalLibrary(uploadDir);
  return library.albums.map((album) => mapLocalAlbum(album, library.photos));
}

export async function getLocalAlbum(uploadDir: string | null, id: string) {
  const albums = await getLocalAlbums(uploadDir);
  return albums.find((album) => album.id === id) ?? null;
}

export async function getLocalPhotosByAlbum(uploadDir: string | null, albumId: string) {
  if (!uploadDir) {
    return [];
  }

  const library = await readLocalLibrary(uploadDir);
  return library.photos
    .filter((photo) => photoAlbumId(photo) === albumId)
    .map(mapLocalPhoto);
}

export async function getLocalAlbumsForUser(uploadDir: string | null, userId: string) {
  const albums = await getLocalAlbums(uploadDir);
  return albums.filter((album) => album.userId === userId);
}

export async function deleteLocalAlbum({
  uploadDir,
  albumId,
  userId,
  isAdmin = false
}: {
  uploadDir: string;
  albumId: string;
  userId: string;
  isAdmin?: boolean;
}) {
  const library = await readLocalLibrary(uploadDir);
  const album = library.albums.find((item) => item.id === albumId);
  if (!album) {
    return { deletedPhotos: 0, missing: true };
  }

  if (!isAdmin && album.user_id !== userId) {
    throw new Error("你只能删除自己的作品。");
  }

  const photosToDelete = library.photos.filter((photo) => photoAlbumId(photo) === albumId);
  await Promise.all(photosToDelete.flatMap((photo) => fileDeleteTasks(uploadDir, photo)));

  await writeLocalLibrary(uploadDir, {
    albums: library.albums.filter((item) => item.id !== albumId),
    photos: library.photos.filter((photo) => photoAlbumId(photo) !== albumId)
  });

  return { deletedPhotos: photosToDelete.length, missing: false };
}

export async function updateLocalAlbum({
  uploadDir,
  albumId,
  userId,
  updates,
  newPhotos = [],
  isAdmin = false
}: {
  uploadDir: string;
  albumId: string;
  userId: string;
  updates: LocalAlbumUpdate;
  newPhotos?: LocalPhotoRecord[];
  isAdmin?: boolean;
}) {
  const library = await readLocalLibrary(uploadDir);
  const album = library.albums.find((item) => item.id === albumId);
  if (!album) {
    return { missing: true, album: null };
  }

  if (!isAdmin && album.user_id !== userId) {
    throw new Error("你只能编辑自己的作品。");
  }

  const title = textOrUndefined(updates.title) ?? album.title;
  const camera = textOrUndefined(updates.camera);
  const lens = textOrUndefined(updates.lens);
  const film = textOrUndefined(updates.film);
  const takenAt = textOrUndefined(updates.taken_at);
  const location = textOrUndefined(updates.location);
  const notes = textOrUndefined(updates.notes);
  const filmBrand = film ? film.split(" ")[0] : undefined;
  const cameraType = inferCameraType(camera);

  const applyCommonUpdates = (photo: LocalPhotoRecord): LocalPhotoRecord => ({
    ...photo,
    camera,
    camera_type: cameraType,
    lens,
    film,
    film_brand: filmBrand,
    iso: updates.iso,
    taken_at: takenAt,
    location,
    notes
  });

  const newPhotoIds = new Set(newPhotos.map((photo) => photo.id));
  const updatedExistingPhotos = library.photos.map((photo) => {
    if (photoAlbumId(photo) !== albumId) {
      return photo;
    }

    return applyCommonUpdates(photo);
  });
  const nextPhotos = [
    ...newPhotos.map(applyCommonUpdates),
    ...updatedExistingPhotos.filter((photo) => !newPhotoIds.has(photo.id))
  ];
  const albumPhotos = nextPhotos.filter((photo) => photoAlbumId(photo) === albumId);
  const albumPhotoIds = albumPhotos.map((photo) => photo.id);
  const cover = albumPhotos.find((photo) => photo.thumbnail_path === album.cover_path) ?? albumPhotos[0];

  const nextAlbum: LocalAlbumRecord = {
    ...album,
    title,
    description: notes,
    cover_path: cover?.thumbnail_path ?? album.cover_path,
    cover_width: cover?.width ?? album.cover_width,
    cover_height: cover?.height ?? album.cover_height,
    photo_ids: albumPhotoIds,
    photo_count: albumPhotoIds.length,
    camera,
    camera_type: cameraType,
    lens,
    film,
    film_brand: filmBrand,
    iso: updates.iso,
    taken_at: takenAt,
    date: takenAt?.slice(0, 10),
    location
  };

  const nextAlbums = library.albums.map((item) => (item.id === albumId ? nextAlbum : item));
  await writeLocalLibrary(uploadDir, { albums: nextAlbums, photos: nextPhotos });

  return { missing: false, album: mapLocalAlbum(nextAlbum, nextPhotos) };
}

export async function assertLocalAlbumEditable({
  uploadDir,
  albumId,
  userId,
  isAdmin = false
}: {
  uploadDir: string;
  albumId: string;
  userId: string;
  isAdmin?: boolean;
}) {
  const library = await readLocalLibrary(uploadDir);
  const album = library.albums.find((item) => item.id === albumId);
  if (!album) {
    return { missing: true };
  }

  if (!isAdmin && album.user_id !== userId) {
    throw new Error("你只能编辑自己的作品。");
  }

  return { missing: false };
}

export async function updateLocalUploaderProfile({
  uploadDir,
  userId,
  displayName,
  avatarUrl
}: {
  uploadDir: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
}) {
  const library = await readLocalLibrary(uploadDir);
  const updateUploader = (uploader: Uploader): Uploader =>
    uploader.id === userId
      ? {
          ...uploader,
          displayName,
          avatarUrl
        }
      : uploader;

  await writeLocalLibrary(uploadDir, {
    albums: library.albums.map((album) => ({
      ...album,
      uploader: updateUploader(album.uploader)
    })),
    photos: library.photos.map((photo) => ({
      ...photo,
      uploader: updateUploader(photo.uploader)
    }))
  });
}

export async function rescanLocalPhotos(uploadDir: string) {
  const originalsDir = path.join(uploadDir, "originals");
  const library = await readLocalLibrary(uploadDir);
  const existingIds = new Set(library.photos.map((photo) => photo.id));
  const recovered: LocalPhotoRecord[] = [];

  for (const filePath of await walkImageFiles(originalsDir)) {
    const relativePath = path.relative(originalsDir, filePath).split(path.sep).join("/");
    const id = path.basename(relativePath, path.extname(relativePath));
    if (existingIds.has(id)) {
      continue;
    }

    const previewPath = replaceExtension(relativePath, ".jpg");
    const thumbnailPath = replaceExtension(relativePath, ".jpg");
    const stat = await fs.stat(filePath).catch(() => null);

    recovered.push({
      id,
      user_id: "local-recovered",
      album_id: id,
      title: path.basename(relativePath, path.extname(relativePath)),
      original_path: relativePath,
      preview_path: fsSync.existsSync(path.join(uploadDir, "previews", previewPath))
        ? previewPath
        : relativePath,
      thumbnail_path: fsSync.existsSync(path.join(uploadDir, "thumbnails", thumbnailPath))
        ? thumbnailPath
        : relativePath,
      visibility: "public",
      created_at: stat?.mtime.toISOString() ?? new Date().toISOString(),
      uploader: {
        id: "local-recovered",
        username: "local",
        displayName: "本地恢复"
      }
    });
  }

  if (recovered.length) {
    await appendLocalPhotos(uploadDir, recovered);
  }

  return recovered.length;
}

async function readLocalLibrary(uploadDir: string): Promise<LocalLibrary> {
  try {
    const raw = await fs.readFile(libraryPath(uploadDir), "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalLibrary>;
    const photos = Array.isArray(parsed.photos) ? parsed.photos : [];
    const albums = Array.isArray(parsed.albums) ? parsed.albums : [];

    return {
      albums: mergeAlbums(albums, deriveAlbumsFromPhotos(photos)),
      photos
    };
  } catch {
    return { albums: [], photos: [] };
  }
}

async function writeLocalLibrary(uploadDir: string, library: LocalLibrary) {
  await fs.writeFile(
    libraryPath(uploadDir),
    JSON.stringify(library, null, 2),
    "utf8"
  );
}

function libraryPath(uploadDir: string) {
  return path.join(uploadDir, LIBRARY_FILE);
}

async function walkImageFiles(root: string) {
  const files: string[] = [];
  const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  await walk(root);
  return files;
}

function replaceExtension(filePath: string, extension: string) {
  return `${filePath.slice(0, -path.extname(filePath).length)}${extension}`;
}

function mergeAlbums(primary: LocalAlbumRecord[], fallback: LocalAlbumRecord[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((album) => {
    if (seen.has(album.id)) {
      return false;
    }
    seen.add(album.id);
    return true;
  });
}

function deriveAlbumsFromPhotos(photos: LocalPhotoRecord[]) {
  const groups = new Map<string, LocalPhotoRecord[]>();
  for (const photo of photos) {
    const albumId = photoAlbumId(photo);
    groups.set(albumId, [...(groups.get(albumId) ?? []), photo]);
  }

  return Array.from(groups.entries()).map(([albumId, group]) => {
    const cover = group[0];
    return {
      id: albumId,
      user_id: cover.user_id,
      title: cleanArchiveTitle(
        group.length === 1 ? cover.title : cover.film || cover.location || "未命名作品组",
        "未命名作品组",
        cover.created_at
      ),
      description: cover.description,
      cover_path: cover.thumbnail_path,
      cover_width: cover.width,
      cover_height: cover.height,
      photo_ids: group.map((photo) => photo.id),
      photo_count: group.length,
      camera: cover.camera,
      camera_type: cover.camera_type,
      lens: cover.lens,
      film: cover.film,
      film_brand: cover.film_brand,
      iso: cover.iso,
      taken_at: cover.taken_at,
      date: cover.taken_at?.slice(0, 10),
      location: cover.location,
      visibility: cover.visibility ?? "public",
      created_at: cover.created_at,
      uploader: cover.uploader
    } satisfies LocalAlbumRecord;
  });
}

function photoAlbumId(photo: LocalPhotoRecord) {
  return photo.album_id ?? photo.series_id ?? photo.id;
}

function mapLocalAlbum(item: LocalAlbumRecord, photos: LocalPhotoRecord[]): Album {
  const albumPhotos = photos.filter((photo) => photoAlbumId(photo) === item.id);
  const cover = albumPhotos.find((photo) => photo.thumbnail_path === item.cover_path) ?? albumPhotos[0];
  const coverPath = item.cover_path || cover?.thumbnail_path || "";

  return {
    id: item.id,
    userId: item.user_id,
    title: cleanArchiveTitle(item.title, "未命名作品组", item.created_at),
    description: item.description,
    coverUrl: coverPath ? `/api/assets/thumbnails/${coverPath}` : "",
    coverWidth: item.cover_width ?? cover?.width ?? 1600,
    coverHeight: item.cover_height ?? cover?.height ?? 1200,
    photoCount: item.photo_count || item.photo_ids.length || albumPhotos.length,
    photoIds: item.photo_ids.length ? item.photo_ids : albumPhotos.map((photo) => photo.id),
    camera: item.camera,
    cameraType: item.camera_type,
    lens: item.lens,
    film: item.film,
    filmBrand: item.film_brand,
    iso: item.iso,
    takenAt: item.taken_at,
    date: item.date ?? item.taken_at?.slice(0, 10),
    location: item.location,
    owner: item.uploader,
    visibility: item.visibility ?? "public",
    createdAt: item.created_at ?? new Date().toISOString()
  };
}

function mapLocalPhoto(item: LocalPhotoRecord): Photo {
  return {
    id: item.id,
    userId: item.user_id,
    albumId: photoAlbumId(item),
    title: cleanArchiveTitle(item.title, "未命名照片", item.created_at),
    description: item.description,
    thumbnailUrl: `/api/assets/thumbnails/${item.thumbnail_path}`,
    previewUrl: `/api/assets/previews/${item.preview_path}`,
    originalUrl: `/api/assets/originals/${item.original_path}`,
    originalPath: item.original_path,
    previewPath: item.preview_path,
    thumbnailPath: item.thumbnail_path,
    width: item.width ?? 1600,
    height: item.height ?? 1200,
    camera: item.camera,
    cameraType: item.camera_type,
    lens: item.lens,
    film: item.film,
    filmBrand: item.film_brand,
    iso: item.iso,
    aperture: item.aperture,
    shutter: item.shutter_speed,
    focalLength: item.focal_length,
    takenAt: item.taken_at,
    location: item.location,
    scanner: item.scanner,
    notes: item.notes,
    uploader: item.uploader,
    visibility: item.visibility ?? "public",
    createdAt: item.created_at ?? new Date().toISOString()
  };
}

function fileDeleteTasks(uploadDir: string, photo: LocalPhotoRecord) {
  return [
    safeDeleteStorageFile(uploadDir, "originals", photo.original_path),
    safeDeleteStorageFile(uploadDir, "backup", photo.original_path),
    safeDeleteStorageFile(uploadDir, "previews", photo.preview_path),
    safeDeleteStorageFile(uploadDir, "thumbnails", photo.thumbnail_path)
  ];
}

async function safeDeleteStorageFile(uploadDir: string, kind: string, relativePath: string) {
  const base = path.resolve(uploadDir, kind);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(base + path.sep) && target !== base) {
    return;
  }

  await fs.unlink(target).catch(() => undefined);
}

function textOrUndefined(value?: string) {
  const text = value?.trim();
  return text ? text : undefined;
}

function inferCameraType(camera?: string): LocalAlbumRecord["camera_type"] {
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

function cleanArchiveTitle(value: string | undefined, fallback: string, date?: string) {
  const title = value?.trim();
  if (!title || isTechnicalTitle(title)) {
    return date ? `${fallback} ${date.slice(0, 10)}` : fallback;
  }

  return title;
}

function isTechnicalTitle(value: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    /^[0-9a-f]{24,}$/i.test(value) ||
    /^\d{4,}$/.test(value)
  );
}

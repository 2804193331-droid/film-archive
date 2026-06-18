"use client";

import { useRouter } from "next/navigation";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, RotateCcw, Star, Trash2, UploadCloud, X } from "lucide-react";
import { cameras, films, lenses } from "@/lib/catalog";
import type { Album, Photo } from "@/lib/types";
import styles from "./edit-album-form.module.css";

type FormState = {
  title: string;
  camera: string;
  lens: string;
  film: string;
  iso: string;
  takenAt: string;
  location: string;
  notes: string;
};

type LocalPhoto = {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
};

type ReplacementPhoto = LocalPhoto & {
  photoId: string;
};

type SignedUpload = {
  id: string;
  originalKey: string;
  uploadUrl: string;
  mimeType: string;
};

const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"];
const maxFiles = 100;
const maxFileSize = 100 * 1024 * 1024;

export function EditAlbumForm({ album, photos }: { album: Album; photos: Photo[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: album.title,
    camera: album.camera ?? "",
    lens: album.lens ?? "",
    film: album.film ?? "",
    iso: album.iso ? String(album.iso) : "",
    takenAt: (album.date ?? album.takenAt)?.slice(0, 10) ?? "",
    location: album.location ?? "",
    notes: album.description ?? ""
  });
  const [addedPhotos, setAddedPhotos] = useState<LocalPhoto[]>([]);
  const [replacementPhotos, setReplacementPhotos] = useState<Record<string, ReplacementPhoto>>({});
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<Set<string>>(new Set());
  const [coverSelection, setCoverSelection] = useState<string | null>(album.coverPhotoId ?? photos[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const addedPhotosRef = useRef<LocalPhoto[]>([]);
  const replacementPhotosRef = useRef<Record<string, ReplacementPhoto>>({});

  const cameraOptions = useMemo(() => cameras.map((camera) => `${camera.brand} ${camera.model}`), []);
  const lensOptions = useMemo(() => lenses.map((lens) => `${lens.brand} ${lens.model}`), []);
  const filmOptions = useMemo(() => films.map((film) => `${film.brand} ${film.name}`), []);
  const visiblePhotos = photos.filter((photo) => !deletedPhotoIds.has(photo.id));
  const uploadCount = addedPhotos.length + Object.keys(replacementPhotos).length;

  useEffect(() => {
    addedPhotosRef.current = addedPhotos;
  }, [addedPhotos]);

  useEffect(() => {
    replacementPhotosRef.current = replacementPhotos;
  }, [replacementPhotos]);

  useEffect(() => {
    return () => {
      addedPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
      Object.values(replacementPhotosRef.current).forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const nextFiles = Array.from(fileList).filter(isSupportedImage);

    if (!nextFiles.length) {
      setMessage(`请选择 ${supportedExtensions.join("、")} 格式的照片。`);
      return;
    }

    if (addedPhotos.length + nextFiles.length > maxFiles) {
      setMessage(`一次最多添加 ${maxFiles} 张照片。`);
      return;
    }

    const oversized = nextFiles.find((file) => file.size > maxFileSize);
    if (oversized) {
      setMessage(`${oversized.name} 超过 100MB。`);
      return;
    }

    const nextPhotos = nextFiles.map((file) => ({
      id: makeClientId(file),
      file,
      name: file.name,
      size: file.size,
      url: URL.createObjectURL(file)
    }));

    setAddedPhotos((current) => [...current, ...nextPhotos]);
    setCoverSelection((current) => current ?? nextPhotos[0]?.id ?? null);
    setMessage("");
  }

  function removeAddedPhoto(photoId: string) {
    const removed = addedPhotos.find((photo) => photo.id === photoId);
    if (removed) URL.revokeObjectURL(removed.url);

    const nextAddedPhotos = addedPhotos.filter((photo) => photo.id !== photoId);
    setAddedPhotos(nextAddedPhotos);
    moveCoverIfNeeded(photoId, visiblePhotos, nextAddedPhotos);
  }

  function markDeletePhoto(photoId: string) {
    const nextDeletedIds = new Set(deletedPhotoIds);
    nextDeletedIds.add(photoId);
    const nextVisiblePhotos = photos.filter((photo) => !nextDeletedIds.has(photo.id));
    setDeletedPhotoIds(nextDeletedIds);
    removeReplacement(photoId);
    moveCoverIfNeeded(photoId, nextVisiblePhotos, addedPhotos);
  }

  function restoreDeletedPhoto(photoId: string) {
    const nextDeletedIds = new Set(deletedPhotoIds);
    nextDeletedIds.delete(photoId);
    setDeletedPhotoIds(nextDeletedIds);
    setCoverSelection((current) => current ?? photoId);
  }

  function moveCoverIfNeeded(removedId: string, nextVisiblePhotos: Photo[], nextAddedPhotos: LocalPhoto[]) {
    setCoverSelection((current) => {
      if (current !== removedId) return current;
      return nextVisiblePhotos[0]?.id ?? nextAddedPhotos[0]?.id ?? null;
    });
  }

  function setReplacement(photoId: string, fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!isSupportedImage(file)) {
      setMessage(`请选择 ${supportedExtensions.join("、")} 格式的照片。`);
      return;
    }

    if (file.size > maxFileSize) {
      setMessage(`${file.name} 超过 100MB。`);
      return;
    }

    const previous = replacementPhotos[photoId];
    if (previous) URL.revokeObjectURL(previous.url);

    setReplacementPhotos((current) => ({
      ...current,
      [photoId]: {
        id: makeClientId(file),
        photoId,
        file,
        name: file.name,
        size: file.size,
        url: URL.createObjectURL(file)
      }
    }));
    setMessage("");
  }

  function removeReplacement(photoId: string) {
    const existing = replacementPhotos[photoId];
    if (existing) URL.revokeObjectURL(existing.url);

    setReplacementPhotos((current) => {
      const next = { ...current };
      delete next[photoId];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      const replacementItems = Object.values(replacementPhotos);
      const uploadItems = [
        ...addedPhotos.map((photo) => ({ kind: "add" as const, photo })),
        ...replacementItems.map((photo) => ({ kind: "replace" as const, photo }))
      ];

      let addedCompleted: Array<CompletedUpload & { localId: string }> = [];
      let replacementCompleted: Array<{ photoId: string; file: CompletedUpload }> = [];

      if (uploadItems.length) {
        setMessage("正在上传照片到 OSS...");
        const signResponse = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            albumId: album.id,
            files: uploadItems.map((item) => ({
              name: item.photo.file.name,
              size: item.photo.file.size,
              type: item.photo.file.type || mimeTypeFromName(item.photo.file.name)
            }))
          })
        });
        const signBody = await signResponse.json().catch(() => ({}));
        if (!signResponse.ok) {
          throw new Error(signBody.error ?? "生成 OSS 上传签名失败。");
        }

        const signedUploads = signBody.uploads as SignedUpload[];
        const completed = await mapWithConcurrency(uploadItems, 3, async (item, index) => {
          const signed = signedUploads[index];
          await putFileToOss(item.photo.file, signed);
          const dimensions = await readImageDimensions(item.photo.file);
          return {
            kind: item.kind,
            localId: item.photo.id,
            photoId: "photoId" in item.photo ? item.photo.photoId : undefined,
            file: {
              id: signed.id,
              name: item.photo.file.name,
              originalKey: signed.originalKey,
              size: item.photo.file.size,
              mimeType: signed.mimeType,
              width: dimensions?.width,
              height: dimensions?.height
            }
          };
        });

        addedCompleted = completed
          .filter((item) => item.kind === "add")
          .map((item) => ({ ...item.file, localId: item.localId }));
        replacementCompleted = completed
          .filter((item) => item.kind === "replace" && item.photoId)
          .map((item) => ({ photoId: item.photoId!, file: item.file }));
      }

      const coverPhotoId = resolveCoverPhotoId(coverSelection, addedCompleted);

      setMessage("正在保存修改...");
      const response = await fetch(`/api/albums/${album.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          coverPhotoId,
          deletePhotoIds: Array.from(deletedPhotoIds),
          files: addedCompleted.map(({ localId, ...file }) => file),
          replacePhotos: replacementCompleted
        })
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "保存失败，请稍后重试。");
      }

      clearLocalUploads();
      router.push(`/album/${album.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  function clearLocalUploads() {
    addedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    Object.values(replacementPhotos).forEach((photo) => URL.revokeObjectURL(photo.url));
    setAddedPhotos([]);
    setReplacementPhotos({});
  }

  return (
    <section className={styles.panel}>
      <label className={styles.full}>
        摄影组名称
        <input
          className="input"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="留空则使用你的名字"
        />
      </label>

      <label>
        相机
        <input className="input" list="edit-camera-list" value={form.camera} onChange={(event) => setForm({ ...form, camera: event.target.value })} />
      </label>

      <label>
        镜头
        <input className="input" list="edit-lens-list" value={form.lens} onChange={(event) => setForm({ ...form, lens: event.target.value })} />
      </label>

      <label>
        胶卷
        <input className="input" list="edit-film-list" value={form.film} onChange={(event) => setForm({ ...form, film: event.target.value })} />
      </label>

      <label>
        ISO
        <input className="input" inputMode="numeric" value={form.iso} onChange={(event) => setForm({ ...form, iso: event.target.value })} />
      </label>

      <label>
        日期
        <input className="input" type="date" value={form.takenAt} onChange={(event) => setForm({ ...form, takenAt: event.target.value })} />
      </label>

      <label>
        地点
        <input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
      </label>

      <label className={styles.full}>
        备注
        <textarea className="textarea" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </label>

      <section className={styles.full}>
        <div className={styles.addPhotosHeader}>
          <div>
            <strong>当前照片</strong>
            <span>封面只作用于当前摄影组。</span>
          </div>
        </div>

        {visiblePhotos.length || addedPhotos.length ? (
          <div className={styles.manageGrid}>
            {visiblePhotos.map((photo) => {
              const replacement = replacementPhotos[photo.id];
              const isCover = coverSelection === photo.id;
              return (
                <article className={`${styles.manageTile} ${isCover ? styles.manageTileActive : ""}`} key={photo.id}>
                  <img
                    src={replacement?.url ?? editPreviewUrl(photo.originalUrl)}
                    alt={photo.title}
                    loading="lazy"
                    decoding="async"
                    onError={replacement ? undefined : (event) => fallBackToOriginal(event, photo.originalUrl)}
                  />
                  <div className={styles.manageTileMeta}>
                    {isCover ? <strong>封面</strong> : <span>照片</span>}
                    {replacement ? <span>已替换</span> : null}
                  </div>
                  <div className={styles.manageTileActions}>
                    <button className="ghost-button" type="button" disabled={busy || isCover} onClick={() => setCoverSelection(photo.id)}>
                      <Star size={14} aria-hidden />
                      设为封面
                    </button>
                    <label className={styles.replaceButton}>
                      <UploadCloud size={14} aria-hidden />
                      替换
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/tiff" disabled={busy} onChange={(event) => setReplacement(photo.id, event.target.files)} />
                    </label>
                    {replacement ? (
                      <button className="icon-button" type="button" disabled={busy} onClick={() => removeReplacement(photo.id)} title="取消替换">
                        <RotateCcw size={15} aria-hidden />
                        <span className="sr-only">取消替换</span>
                      </button>
                    ) : null}
                    <button className="icon-button" type="button" disabled={busy} onClick={() => markDeletePhoto(photo.id)} title="删除照片">
                      <Trash2 size={15} aria-hidden />
                      <span className="sr-only">删除照片</span>
                    </button>
                  </div>
                </article>
              );
            })}

            {addedPhotos.map((photo) => {
              const isCover = coverSelection === photo.id;
              return (
                <article className={`${styles.manageTile} ${isCover ? styles.manageTileActive : ""}`} key={photo.id}>
                  <img src={photo.url} alt={photo.name} loading="lazy" decoding="async" />
                  <div className={styles.manageTileMeta}>
                    {isCover ? <strong>封面</strong> : <span>新增</span>}
                  </div>
                  <div className={styles.manageTileActions}>
                    <button className="ghost-button" type="button" disabled={busy || isCover} onClick={() => setCoverSelection(photo.id)}>
                      <Star size={14} aria-hidden />
                      设为封面
                    </button>
                    <button className="icon-button" type="button" disabled={busy} onClick={() => removeAddedPhoto(photo.id)} title="移除照片">
                      <X size={15} aria-hidden />
                      <span className="sr-only">移除照片</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyPhotos}>这个摄影组里暂时没有照片。</p>
        )}
      </section>

      {deletedPhotoIds.size ? (
        <section className={styles.full}>
          <div className={styles.deletedList}>
            {Array.from(deletedPhotoIds).map((photoId) => {
              const photo = photos.find((item) => item.id === photoId);
              return (
                <button className="ghost-button" type="button" disabled={busy} key={photoId} onClick={() => restoreDeletedPhoto(photoId)}>
                  <RotateCcw size={15} aria-hidden />
                  恢复 {photo?.title ?? "照片"}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className={styles.full}>
        <div className={styles.addPhotosHeader}>
          <div>
            <strong>继续添加照片</strong>
            <span>新照片会追加到当前摄影组，不会覆盖原照片。</span>
          </div>
        </div>

        <label className={styles.filePicker}>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/tiff" disabled={busy} onChange={(event) => addFiles(event.target.files)} />
          <span>
            <ImagePlus size={16} aria-hidden />
            {addedPhotos.length ? `已新增 ${addedPhotos.length} 张，继续选择` : "选择要添加的照片"}
          </span>
        </label>
      </div>

      <datalist id="edit-camera-list">
        {cameraOptions.map((camera) => (
          <option key={camera} value={camera} />
        ))}
      </datalist>
      <datalist id="edit-lens-list">
        {lensOptions.map((lens) => (
          <option key={lens} value={lens} />
        ))}
      </datalist>
      <datalist id="edit-film-list">
        {filmOptions.map((film) => (
          <option key={film} value={film} />
        ))}
      </datalist>

      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.actions}>
        <button className="button" type="button" disabled={busy} onClick={save}>
          {busy ? "保存中" : uploadCount ? `保存修改（${uploadCount} 张待上传）` : "保存修改"}
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => router.back()}>
          取消
        </button>
      </div>
    </section>
  );
}

type CompletedUpload = {
  id: string;
  name: string;
  originalKey: string;
  size: number;
  mimeType: string;
  width?: number;
  height?: number;
};

function resolveCoverPhotoId(coverSelection: string | null, addedCompleted: Array<CompletedUpload & { localId: string }>) {
  if (!coverSelection) {
    return null;
  }

  return addedCompleted.find((photo) => photo.localId === coverSelection)?.id ?? coverSelection;
}

function putFileToOss(file: File, signed: SignedUpload) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl);
    xhr.setRequestHeader("Content-Type", signed.mimeType);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`OSS 上传失败：${file.name}`));
    };
    xhr.onerror = () => reject(new Error("OSS 上传失败，请检查 Bucket CORS 设置。"));
    xhr.send(file);
  });
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>) {
  const results: R[] = [];
  let nextIndex = 0;

  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number } | undefined>((resolve) => {
    if (!file.type.startsWith("image/")) {
      resolve(undefined);
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    }, 3000);

    image.onload = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(undefined);
    };
    image.src = url;
  });
}

function isSupportedImage(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

function mimeTypeFromName(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".tif") || lowerName.endsWith(".tiff")) return "image/tiff";
  return "image/jpeg";
}

function makeClientId(file: File) {
  return `${window.crypto?.randomUUID?.() ?? `${file.name}-${file.lastModified}-${Math.random()}`}`;
}

function editPreviewUrl(url: string) {
  if (!url || url.startsWith("blob:") || !isAliOssUrl(url)) {
    return url;
  }

  const process = encodeURIComponent("image/resize,w_420/quality,q_72/format,jpg");
  return `${url}${url.includes("?") ? "&" : "?"}x-oss-process=${process}`;
}

function isAliOssUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes(".oss-") || hostname.endsWith(".aliyuncs.com");
  } catch {
    return false;
  }
}

function fallBackToOriginal(event: SyntheticEvent<HTMLImageElement>, fallbackUrl: string) {
  const image = event.currentTarget;
  if (image.src !== fallbackUrl) {
    image.src = fallbackUrl;
  }
}

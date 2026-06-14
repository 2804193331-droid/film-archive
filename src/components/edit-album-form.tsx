"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cameras, films, lenses } from "@/lib/catalog";
import type { Album } from "@/lib/types";
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

type PreviewItem = {
  id: string;
  url: string;
  name: string;
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

export function EditAlbumForm({ album }: { album: Album }) {
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
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const cameraOptions = useMemo(() => cameras.map((camera) => `${camera.brand} ${camera.model}`), []);
  const lensOptions = useMemo(() => lenses.map((lens) => `${lens.brand} ${lens.model}`), []);
  const filmOptions = useMemo(() => films.map((film) => `${film.brand} ${film.name}`), []);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const nextFiles = Array.from(fileList).filter(isSupportedImage);
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));

    if (nextFiles.length > maxFiles) {
      setMessage(`一次最多添加 ${maxFiles} 张照片。`);
      return;
    }

    const oversized = nextFiles.find((file) => file.size > maxFileSize);
    if (oversized) {
      setMessage(`${oversized.name} 超过 100MB。`);
      return;
    }

    setFiles(nextFiles);
    setPreviews(
      nextFiles.slice(0, 12).map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file)
      }))
    );
    setMessage("");
  }

  function clearFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles([]);
    setPreviews([]);
  }

  async function save() {
    setBusy(true);
    setMessage("");

    try {
      let completed: Array<{
        id: string;
        name: string;
        originalKey: string;
        size: number;
        mimeType: string;
        width?: number;
        height?: number;
      }> = [];

      if (files.length) {
        setMessage("正在上传新增照片到 OSS...");
        const signResponse = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            albumId: album.id,
            files: files.map((file) => ({
              name: file.name,
              size: file.size,
              type: file.type || mimeTypeFromName(file.name)
            }))
          })
        });
        const signBody = await signResponse.json().catch(() => ({}));
        if (!signResponse.ok) {
          throw new Error(signBody.error ?? "生成 OSS 上传签名失败。");
        }

        const signedUploads = signBody.uploads as SignedUpload[];
        completed = await mapWithConcurrency(files, 3, async (file, index) => {
          const signed = signedUploads[index];
          await putFileToOss(file, signed);
          const dimensions = await readImageDimensions(file);
          return {
            id: signed.id,
            name: file.name,
            originalKey: signed.originalKey,
            size: file.size,
            mimeType: signed.mimeType,
            width: dimensions?.width,
            height: dimensions?.height
          };
        });
      }

      setMessage("正在保存修改...");
      const response = await fetch(`/api/albums/${album.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, files: completed })
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error ?? "保存失败，请稍后重试。");
      }

      clearFiles();
      router.push(`/album/${album.id}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
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

      <div className={styles.full}>
        <div className={styles.addPhotosHeader}>
          <div>
            <strong>添加照片</strong>
            <span>可在编辑时继续往这个摄影组里补照片。</span>
          </div>
          {files.length ? (
            <button className="ghost-button" type="button" disabled={busy} onClick={clearFiles}>
              清空
            </button>
          ) : null}
        </div>

        <label className={styles.filePicker}>
          <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/tiff" disabled={busy} onChange={(event) => addFiles(event.target.files)} />
          <span>{files.length ? `已选择 ${files.length} 张照片` : "选择要添加的照片"}</span>
        </label>

        {previews.length ? (
          <div className={styles.previewGrid}>
            {previews.map((preview) => (
              <img key={preview.id} src={preview.url} alt={preview.name} title={preview.name} />
            ))}
          </div>
        ) : null}
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
          {busy ? "保存中" : "保存修改"}
        </button>
        <button className="ghost-button" type="button" disabled={busy} onClick={() => router.back()}>
          取消
        </button>
      </div>
    </section>
  );
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

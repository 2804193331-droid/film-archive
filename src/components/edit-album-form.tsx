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

const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"];

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
    setFiles(nextFiles);
    setPreviews(
      nextFiles.slice(0, 12).map((file, index) => ({
        id: `${file.name}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file)
      }))
    );
  }

  function clearFiles() {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    setFiles([]);
    setPreviews([]);
  }

  async function save() {
    setBusy(true);
    setMessage("");

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    files.forEach((file) => payload.append("files", file));

    const response = await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      body: payload
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? "保存失败，请稍后重试。");
      return;
    }

    clearFiles();
    router.push(`/album/${album.id}`);
    router.refresh();
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
        <input
          className="input"
          list="edit-camera-list"
          value={form.camera}
          onChange={(event) => setForm({ ...form, camera: event.target.value })}
        />
      </label>

      <label>
        镜头
        <input
          className="input"
          list="edit-lens-list"
          value={form.lens}
          onChange={(event) => setForm({ ...form, lens: event.target.value })}
        />
      </label>

      <label>
        胶卷
        <input
          className="input"
          list="edit-film-list"
          value={form.film}
          onChange={(event) => setForm({ ...form, film: event.target.value })}
        />
      </label>

      <label>
        ISO
        <input
          className="input"
          inputMode="numeric"
          value={form.iso}
          onChange={(event) => setForm({ ...form, iso: event.target.value })}
        />
      </label>

      <label>
        日期
        <input
          className="input"
          type="date"
          value={form.takenAt}
          onChange={(event) => setForm({ ...form, takenAt: event.target.value })}
        />
      </label>

      <label>
        地点
        <input
          className="input"
          value={form.location}
          onChange={(event) => setForm({ ...form, location: event.target.value })}
        />
      </label>

      <label className={styles.full}>
        备注
        <textarea
          className="textarea"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
        />
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
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/tiff"
            disabled={busy}
            onChange={(event) => addFiles(event.target.files)}
          />
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

function isSupportedImage(file: File) {
  const lowerName = file.name.toLowerCase();
  return supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

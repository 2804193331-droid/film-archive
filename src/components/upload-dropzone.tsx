"use client";

import {
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  FolderUp,
  ImageIcon,
  RotateCcw,
  Star,
  Trash2,
  UploadCloud,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cameras, films, lenses } from "@/lib/catalog";
import styles from "./upload-dropzone.module.css";

type UploadState = "idle" | "uploading" | "done" | "error";

type SelectedPhoto = {
  id: string;
  file: File;
  name: string;
  size: number;
  url: string;
};

type UploadMetadata = {
  albumTitle: string;
  camera: string;
  lens: string;
  film: string;
  iso: string;
  takenAt: string;
  location: string;
  notes: string;
};

type CustomOptionPools = {
  cameras: string[];
  lenses: string[];
  films: string[];
};

type ExifRecord = Record<string, unknown>;

type StorageStatus = {
  provider?: string;
  configured: boolean;
  online?: boolean;
  bucket?: string;
  region?: string;
  endpoint?: string;
  readOnly?: boolean;
};

type SignedUpload = {
  id: string;
  originalKey: string;
  uploadUrl: string;
  mimeType: string;
  size: number;
  filename: string;
};

const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"];
const maxFiles = 100;
const maxFileSize = 100 * 1024 * 1024;
const customOptionsStorageKey = "film-archive-custom-options";
const emptyMetadata: UploadMetadata = {
  albumTitle: "",
  camera: "",
  lens: "",
  film: "",
  iso: "",
  takenAt: "",
  location: "",
  notes: ""
};

export function UploadDropzone({ readOnly }: { readOnly: boolean }) {
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedPhoto[]>([]);
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [metadataStatus, setMetadataStatus] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [customOptions, setCustomOptions] = useState<CustomOptionPools>({ cameras: [], lenses: [], films: [] });
  const [metadata, setMetadata] = useState<UploadMetadata>(emptyMetadata);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedPhotosRef = useRef<SelectedPhoto[]>([]);
  const selectionIdRef = useRef(0);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    selectedPhotosRef.current = selectedPhotos;
  }, [selectedPhotos]);

  useEffect(() => {
    return () => {
      selectedPhotosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => setSignedIn(Boolean(body.user)))
      .catch(() => setSignedIn(false));
  }, []);

  useEffect(() => {
    setCustomOptions(readCustomOptions());
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/storage/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (mounted) setStorageStatus(body);
      })
      .catch(() => {
        if (mounted) {
          setStorageStatus({
            configured: false,
            online: false,
            readOnly: true
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalSize = useMemo(() => selectedPhotos.reduce((sum, photo) => sum + photo.size, 0), [selectedPhotos]);
  const coverPhoto = selectedPhotos.find((photo) => photo.id === coverPhotoId) ?? selectedPhotos[0];
  const cameraOptions = useMemo(
    () => mergeOptions(cameras.map((camera) => `${camera.brand} ${camera.model}`), customOptions.cameras),
    [customOptions.cameras]
  );
  const lensOptions = useMemo(
    () => mergeOptions(lenses.map((lens) => `${lens.brand} ${lens.model}`), customOptions.lenses),
    [customOptions.lenses]
  );
  const filmOptions = useMemo(
    () => mergeOptions(films.map((film) => `${film.brand} ${film.name}`), customOptions.films),
    [customOptions.films]
  );
  const storageChecking = storageStatus === null;
  const storageUnavailable = storageStatus?.configured === false || storageStatus?.readOnly === true;
  const pickerDisabled = state === "uploading";
  const uploadDisabled = readOnly || !signedIn || storageChecking || storageUnavailable || state === "uploading";
  const hasFiles = selectedPhotos.length > 0;
  const storageNotice = storageUnavailable
    ? "阿里云 OSS 还没有配置好。请先添加 ALI_OSS_ACCESS_KEY_ID 和 ALI_OSS_ACCESS_KEY_SECRET，并检查 Bucket CORS。"
    : "";

  function addFiles(fileList: FileList | null) {
    if (!fileList || pickerDisabled) return;

    const wasEmpty = selectedPhotos.length === 0;
    const nextFiles = Array.from(fileList).filter(isSupportedImage);
    const selectionId = selectionIdRef.current + 1;
    selectionIdRef.current = selectionId;
    setProgress(0);
    setState("idle");

    if (wasEmpty) {
      setMetadata(emptyMetadata);
      setMetadataStatus("");
    }

    if (!nextFiles.length) {
      setMessage(`请选择 ${supportedExtensions.join("、")} 格式的照片。`);
      return;
    }

    if (selectedPhotos.length + nextFiles.length > maxFiles) {
      setMessage(`一次最多上传 ${maxFiles} 张照片。`);
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

    setSelectedPhotos((current) => [...current, ...nextPhotos]);
    setCoverPhotoId((current) => current ?? nextPhotos[0]?.id ?? null);
    setMessage("");

    const finalCount = selectedPhotos.length + nextPhotos.length;
    if (wasEmpty && finalCount === 1) {
      setMetadataStatus("正在读取 EXIF...");
      void readMetadataFromFile(nextPhotos[0].file, selectionId);
      return;
    }

    setMetadataStatus("系列上传使用统一参数。");
  }

  function removePhoto(photoId: string) {
    const nextPhotos = selectedPhotos.filter((photo) => photo.id !== photoId);
    const removed = selectedPhotos.find((photo) => photo.id === photoId);
    if (removed) URL.revokeObjectURL(removed.url);

    setSelectedPhotos(nextPhotos);
    setCoverPhotoId((current) => (current === photoId ? nextPhotos[0]?.id ?? null : current));
    setMessage("");
  }

  function clearFiles() {
    selectionIdRef.current += 1;
    resetSelectedFiles();
    setMetadata(emptyMetadata);
    setState("idle");
    setProgress(0);
    setMessage("");
    setMetadataStatus("");
  }

  function resetSelectedFiles() {
    selectedPhotos.forEach((photo) => URL.revokeObjectURL(photo.url));
    setSelectedPhotos([]);
    setCoverPhotoId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  async function upload() {
    if (!selectedPhotos.length) {
      setMessage("请先选择照片。");
      return;
    }

    if (!signedIn) {
      setMessage("请先登录后再上传。");
      return;
    }

    if (storageUnavailable) {
      setMessage(storageNotice);
      return;
    }

    saveCustomOptionsFromMetadata(metadata);
    setState("uploading");
    setProgress(0);
    setMessage("正在准备 OSS 直传...");

    try {
      const signResponse = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: selectedPhotos.map((photo) => ({
            name: photo.file.name,
            size: photo.file.size,
            type: photo.file.type || mimeTypeFromName(photo.file.name)
          }))
        })
      });
      const signBody = await signResponse.json().catch(() => ({}));
      if (!signResponse.ok) {
        throw new Error(signBody.error ?? "生成 OSS 上传签名失败。");
      }

      const signedUploads = signBody.uploads as SignedUpload[];
      const albumId = signBody.albumId as string;
      const loadedByIndex = new Map<number, number>();
      const totalBytes = Math.max(1, totalSize);

      setMessage("正在上传到阿里云 OSS...");
      const completed = await mapWithConcurrency(selectedPhotos, 3, async (photo, index) => {
        const signed = signedUploads[index];
        await putFileToOss(photo.file, signed, (loaded) => {
          loadedByIndex.set(index, loaded);
          const uploadedBytes = Array.from(loadedByIndex.values()).reduce((sum, value) => sum + value, 0);
          setProgress(Math.min(95, Math.round((uploadedBytes / totalBytes) * 95)));
        });
        loadedByIndex.set(index, photo.file.size);
        const dimensions = await readImageDimensions(photo.file);
        return {
          id: signed.id,
          name: photo.file.name,
          originalKey: signed.originalKey,
          size: photo.file.size,
          mimeType: signed.mimeType,
          width: dimensions?.width,
          height: dimensions?.height
        };
      });

      const coverFileIndex = Math.max(
        0,
        selectedPhotos.findIndex((photo) => photo.id === coverPhoto?.id)
      );

      setProgress(97);
      setMessage("正在写入作品数据库...");
      const completeResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId, coverFileIndex, metadata, files: completed })
      });
      const completeBody = await completeResponse.json().catch(() => ({}));
      if (!completeResponse.ok) {
        throw new Error(completeBody.error ?? "上传入库失败。");
      }

      setState("done");
      setProgress(100);
      resetSelectedFiles();
      setMessage("上传完成。");
      window.setTimeout(() => {
        window.location.href = `/album/${albumId}`;
      }, 700);
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "上传失败，请重试。");
    }
  }

  return (
    <section className={styles.layout}>
      <div
        className={`${styles.dropzone} ${hasFiles ? styles.dropzoneWithPreview : ""}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        {hasFiles ? (
          <div className={styles.previewPanel}>
            <div className={styles.previewToolbar}>
              <span>
                <ImageIcon size={17} aria-hidden />
                预览
              </span>
              <button className="icon-button" type="button" disabled={pickerDisabled} onClick={clearFiles} title="清空选择">
                <X size={17} aria-hidden />
                <span className="sr-only">清空选择</span>
              </button>
            </div>

            <div className={styles.previewHero}>
              <img src={coverPhoto?.url} alt={coverPhoto?.name ?? "照片预览"} />
            </div>

            <div className={styles.previewInfo}>
              <strong>{selectedPhotos.length === 1 ? coverPhoto?.name : `${selectedPhotos.length} 张照片`}</strong>
              <span>{formatBytes(totalSize)}</span>
            </div>

            <div className={styles.previewGrid} aria-label="已选择照片预览">
              {selectedPhotos.map((photo, index) => {
                const isCover = photo.id === coverPhoto?.id;
                return (
                  <div className={`${styles.previewTile} ${isCover ? styles.previewTileActive : ""}`} key={photo.id}>
                    <img src={photo.url} alt={photo.name} title={photo.name} />
                    <div className={styles.previewTileMeta}>
                      <span>{index + 1}</span>
                      {isCover ? <strong>封面</strong> : null}
                    </div>
                    <div className={styles.previewTileActions}>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={pickerDisabled || isCover}
                        onClick={() => setCoverPhotoId(photo.id)}
                      >
                        <Star size={14} aria-hidden />
                        设为封面
                      </button>
                      <button className="icon-button" type="button" disabled={pickerDisabled} onClick={() => removePhoto(photo.id)} title="删除照片">
                        <Trash2 size={15} aria-hidden />
                        <span className="sr-only">删除照片</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {metadataStatus ? <div className={styles.detectedMeta}>{metadataStatus}</div> : null}

            <div className={styles.dropActions}>
              <button className="ghost-button" type="button" disabled={pickerDisabled} onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={17} aria-hidden />
                继续添加照片
              </button>
              <button className="ghost-button" type="button" disabled={pickerDisabled} onClick={() => folderInputRef.current?.click()}>
                <FolderPlus size={17} aria-hidden />
                继续添加文件夹
              </button>
            </div>
          </div>
        ) : (
          <>
            <UploadCloud size={40} aria-hidden />
            <h2>上传照片</h2>
            {!signedIn ? <div className={styles.authNotice}>请先登录。</div> : null}
            {storageNotice ? <div className={styles.authNotice}>{storageNotice}</div> : null}
            <div className={styles.dropActions}>
              <button className="button" type="button" disabled={pickerDisabled} onClick={() => fileInputRef.current?.click()}>
                <UploadCloud size={17} aria-hidden />
                选择照片
              </button>
              <button className="ghost-button" type="button" disabled={pickerDisabled} onClick={() => folderInputRef.current?.click()}>
                <FolderUp size={17} aria-hidden />
                选择文件夹
              </button>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff"
          onChange={(event) => addFiles(event.target.files)}
        />
        <input
          ref={folderInputRef}
          className="sr-only"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/tiff"
          onChange={(event) => addFiles(event.target.files)}
        />
      </div>

      <div className={styles.metaPanel}>
        <label className={styles.full}>
          摄影组名称
          <input
            className="input"
            value={metadata.albumTitle}
            onChange={(event) => setMetadata({ ...metadata, albumTitle: event.target.value })}
            placeholder="例如 京都春天 / Kodak Gold 上海街头"
          />
        </label>
        <label>
          相机
          <input
            className="input"
            list="camera-list"
            value={metadata.camera}
            onChange={(event) => setMetadata({ ...metadata, camera: event.target.value })}
            onBlur={() => saveCustomOption("cameras", metadata.camera)}
          />
        </label>
        <label>
          镜头
          <input
            className="input"
            list="lens-list"
            value={metadata.lens}
            onChange={(event) => setMetadata({ ...metadata, lens: event.target.value })}
            onBlur={() => saveCustomOption("lenses", metadata.lens)}
          />
        </label>
        <label>
          胶卷
          <input
            className="input"
            list="film-list"
            value={metadata.film}
            onChange={(event) => setMetadata({ ...metadata, film: event.target.value })}
            onBlur={() => saveCustomOption("films", metadata.film)}
          />
        </label>
        <label>
          ISO
          <input
            className="input"
            inputMode="numeric"
            value={metadata.iso}
            onChange={(event) => setMetadata({ ...metadata, iso: event.target.value })}
          />
        </label>
        <label>
          日期
          <input
            className="input"
            type="date"
            value={metadata.takenAt}
            onChange={(event) => setMetadata({ ...metadata, takenAt: event.target.value })}
          />
        </label>
        <label>
          地点
          <input
            className="input"
            value={metadata.location}
            onChange={(event) => setMetadata({ ...metadata, location: event.target.value })}
          />
        </label>
        <label className={styles.full}>
          备注
          <textarea className="textarea" value={metadata.notes} onChange={(event) => setMetadata({ ...metadata, notes: event.target.value })} />
        </label>

        <datalist id="camera-list">
          {cameraOptions.map((camera) => (
            <option key={camera} value={camera} />
          ))}
        </datalist>
        <datalist id="lens-list">
          {lensOptions.map((lens) => (
            <option key={lens} value={lens} />
          ))}
        </datalist>
        <datalist id="film-list">
          {filmOptions.map((film) => (
            <option key={film} value={film} />
          ))}
        </datalist>

        <div className={`${styles.storageState} ${storageUnavailable ? styles.storageError : styles.storageOk}`}>
          {storageUnavailable ? <AlertCircle size={16} aria-hidden /> : <CheckCircle2 size={16} aria-hidden />}
          <span>
            {storageUnavailable
              ? "OSS 未就绪，暂时不能上传。"
              : storageStatus
                ? `OSS 已连接：${storageStatus.bucket ?? "film-archive-images"}`
                : "正在检查 OSS 状态..."}
          </span>
        </div>

        <div className={styles.summary}>
          <span>{selectedPhotos.length} 张</span>
          <span>{formatBytes(totalSize)}</span>
        </div>
        {state === "uploading" || state === "done" ? (
          <div className={styles.progress} aria-label="上传进度">
            <span style={{ width: `${progress}%` }} />
          </div>
        ) : null}
        {message ? <p className={styles.message}>{message}</p> : null}

        <div className={styles.actions}>
          <button className="button" type="button" disabled={uploadDisabled || !selectedPhotos.length} onClick={upload}>
            上传
          </button>
          {state === "error" ? (
            <button className="ghost-button" type="button" onClick={upload}>
              <RotateCcw size={17} aria-hidden />
              重试
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );

  async function readMetadataFromFile(file: File, selectionId: number) {
    try {
      const exifr = (await import("exifr")).default;
      const exif = (await exifr.parse(file, true).catch(() => null)) as ExifRecord | null;
      if (selectionIdRef.current !== selectionId) return;

      if (!exif) {
        setMetadataStatus("未读取到 EXIF。");
        return;
      }

      const detected = metadataFromExif(exif);
      const filledLabels = Object.entries(detected)
        .filter(([, value]) => Boolean(value))
        .map(([key]) => metadataLabel(key as keyof UploadMetadata));

      setMetadata({
        ...emptyMetadata,
        camera: detected.camera || "",
        lens: detected.lens || "",
        film: detected.film || "",
        iso: detected.iso || "",
        takenAt: detected.takenAt || "",
        notes: detected.notes || ""
      });

      if (detected.camera) saveCustomOption("cameras", detected.camera);
      if (detected.lens) saveCustomOption("lenses", detected.lens);
      if (detected.film) saveCustomOption("films", detected.film);

      setMetadataStatus(filledLabels.length ? `已读取：${filledLabels.join("、")}` : "未读取到可用 EXIF。");
    } catch {
      if (selectionIdRef.current === selectionId) {
        setMetadataStatus("未读取到 EXIF。");
      }
    }
  }

  function saveCustomOptionsFromMetadata(value: UploadMetadata) {
    saveCustomOption("cameras", value.camera);
    saveCustomOption("lenses", value.lens);
    saveCustomOption("films", value.film);
  }

  function saveCustomOption(kind: keyof CustomOptionPools, value: string) {
    const normalized = value.trim();
    if (!normalized) return;

    setCustomOptions((current) => {
      const next = { ...current, [kind]: mergeOptions(current[kind], [normalized]).slice(0, 80) };
      writeCustomOptions(next);
      return next;
    });
  }
}

function putFileToOss(file: File, signed: SignedUpload, onProgress: (loaded: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signed.uploadUrl);
    xhr.setRequestHeader("Content-Type", signed.mimeType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded);
      }
    };
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

function metadataFromExif(exif: ExifRecord): Partial<UploadMetadata> {
  const camera = joinText(exif.Make, exif.Model);
  const lens = readFirstText(exif.LensModel, exif.Lens, exif.LensID, exif.LensInfo);
  const film = inferFilmFromExif(exif);
  const date = exif.DateTimeOriginal instanceof Date ? formatDateInput(exif.DateTimeOriginal) : "";
  const description = readFirstText(exif.ImageDescription, exif.UserComment, exif.Caption);

  return { camera, lens, film, iso: formatNumber(exif.ISO), takenAt: date, notes: description };
}

function inferFilmFromExif(exif: ExifRecord) {
  const text = [exif.ImageDescription, exif.UserComment, exif.Caption, exif.Subject, exif.Keywords, exif.Software]
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!text) return "";

  const match = films.find((film) => {
    const fullName = `${film.brand} ${film.name}`.toLowerCase();
    return text.includes(fullName) || text.includes(film.name.toLowerCase());
  });

  return match ? `${match.brand} ${match.name}` : "";
}

function readFirstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (Array.isArray(value) && value.length) return value.filter(Boolean).join(" ");
  }
  return "";
}

function joinText(...values: unknown[]) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function metadataLabel(key: keyof UploadMetadata) {
  const labels: Partial<Record<keyof UploadMetadata, string>> = {
    camera: "相机",
    lens: "镜头",
    film: "胶卷",
    iso: "ISO",
    takenAt: "日期",
    notes: "备注"
  };

  return labels[key] ?? key;
}

function readCustomOptions(): CustomOptionPools {
  if (typeof window === "undefined") return { cameras: [], lenses: [], films: [] };

  try {
    const parsed = JSON.parse(window.localStorage.getItem(customOptionsStorageKey) ?? "{}") as Partial<CustomOptionPools>;
    return {
      cameras: Array.isArray(parsed.cameras) ? parsed.cameras : [],
      lenses: Array.isArray(parsed.lenses) ? parsed.lenses : [],
      films: Array.isArray(parsed.films) ? parsed.films : []
    };
  } catch {
    return { cameras: [], lenses: [], films: [] };
  }
}

function writeCustomOptions(options: CustomOptionPools) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(customOptionsStorageKey, JSON.stringify(options));
}

function mergeOptions(...groups: string[][]) {
  const seen = new Set<string>();
  return groups
    .flat()
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function formatNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? trimNumber(value) : "";
}

function trimNumber(value: number) {
  return Number(value.toFixed(2)).toString();
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

function makeClientId(file: File) {
  return `${window.crypto?.randomUUID?.() ?? `${file.name}-${file.lastModified}-${Math.random()}`}`;
}

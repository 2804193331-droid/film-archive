import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_FILE = ".film-archive-config.json";
const STORAGE_DIRS = ["originals", "previews", "thumbnails", "backup"] as const;
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff"]);

export type StorageKind = (typeof STORAGE_DIRS)[number];

export type StorageStatus = {
  configured: boolean;
  uploadDir?: string;
  online: boolean;
  readOnly: boolean;
  usedBytes: number;
  freeBytes?: number;
  totalBytes?: number;
  imageCount: number;
  missingDirs: string[];
};

type ConfigFile = {
  uploadDir?: string;
};

export async function getConfiguredUploadDir() {
  const envDir = process.env.UPLOAD_DIR?.trim();
  if (envDir) {
    return path.resolve(envDir);
  }

  try {
    const raw = await fs.readFile(path.join(process.cwd(), CONFIG_FILE), "utf8");
    const config = JSON.parse(raw) as ConfigFile;
    return config.uploadDir ? path.resolve(config.uploadDir) : null;
  } catch {
    return null;
  }
}

export async function writeUploadDirConfig(uploadDir: string) {
  const resolved = path.resolve(uploadDir);
  await ensureStorageStructure(resolved);
  await fs.writeFile(
    path.join(process.cwd(), CONFIG_FILE),
    JSON.stringify({ uploadDir: resolved }, null, 2),
    "utf8"
  );
  return resolved;
}

export async function ensureStorageStructure(uploadDir: string) {
  await fs.mkdir(uploadDir, { recursive: true });
  await Promise.all(STORAGE_DIRS.map((dir) => fs.mkdir(path.join(uploadDir, dir), { recursive: true })));
}

export async function getStorageStatus(): Promise<StorageStatus> {
  const uploadDir = await getConfiguredUploadDir();
  if (!uploadDir) {
    return {
      configured: false,
      online: false,
      readOnly: true,
      usedBytes: 0,
      imageCount: 0,
      missingDirs: [...STORAGE_DIRS]
    };
  }

  const online = fsSync.existsSync(uploadDir);
  if (!online) {
    return {
      configured: true,
      uploadDir,
      online: false,
      readOnly: true,
      usedBytes: 0,
      imageCount: 0,
      missingDirs: [...STORAGE_DIRS]
    };
  }

  const missingDirs = STORAGE_DIRS.filter((dir) => !fsSync.existsSync(path.join(uploadDir, dir)));
  const [usage, space] = await Promise.all([getDirectoryUsage(uploadDir), getDiskSpace(uploadDir)]);

  return {
    configured: true,
    uploadDir,
    online: true,
    readOnly: missingDirs.length > 0,
    usedBytes: usage.bytes,
    imageCount: usage.images,
    missingDirs,
    ...space
  };
}

export async function detectStorageCandidates() {
  const platform = os.platform();

  if (platform === "darwin") {
    return readExistingChildren("/Volumes");
  }

  if (platform === "linux") {
    const [mnt, media] = await Promise.all([readExistingChildren("/mnt"), readExistingChildren("/media")]);
    return [...mnt, ...media];
  }

  if (platform === "win32") {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    return letters
      .map((letter) => `${letter}:\\`)
      .filter((drive) => fsSync.existsSync(drive));
  }

  return [process.cwd()];
}

export async function resolveStorageFile(kind: StorageKind, relativePath: string) {
  const uploadDir = await getConfiguredUploadDir();
  if (!uploadDir) {
    return null;
  }

  const base = path.resolve(uploadDir, kind);
  const target = path.resolve(base, relativePath);
  if (!target.startsWith(base + path.sep) && target !== base) {
    return null;
  }

  return target;
}

export function toAssetUrl(kind: StorageKind, relativePath: string) {
  return `/api/assets/${kind}/${relativePath.split(path.sep).join("/")}`;
}

export function formatBytes(bytes?: number) {
  if (bytes === undefined) {
    return "未知";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

async function readExistingChildren(root: string) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

async function getDirectoryUsage(root: string) {
  let bytes = 0;
  let images = 0;

  async function walk(current: string) {
    let entries: fsSync.Dirent[];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          return;
        }

        if (!entry.isFile()) {
          return;
        }

        try {
          const stat = await fs.stat(fullPath);
          bytes += stat.size;
          if (IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
            images += 1;
          }
        } catch {
          // Ignore files that disappear during scanning.
        }
      })
    );
  }

  await walk(root);
  return { bytes, images };
}

async function getDiskSpace(root: string) {
  try {
    const stat = await fs.statfs(root);
    return {
      freeBytes: stat.bavail * stat.bsize,
      totalBytes: stat.blocks * stat.bsize
    };
  } catch {
    return {};
  }
}

export type Visibility = "public" | "private" | "unlisted";

export type Uploader = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
};

export type Photo = {
  id: string;
  userId: string;
  albumId?: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string;
  originalPath?: string;
  previewPath?: string;
  thumbnailPath?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  width: number;
  height: number;
  camera?: string;
  cameraType?: "135" | "120" | "digital";
  lens?: string;
  film?: string;
  filmBrand?: string;
  iso?: number;
  aperture?: string;
  shutter?: string;
  focalLength?: string;
  takenAt?: string;
  location?: string;
  scanner?: string;
  notes?: string;
  uploader: Uploader;
  visibility: Visibility;
  createdAt: string;
};

export type Album = {
  id: string;
  userId: string;
  title: string;
  description?: string;
  coverUrl: string;
  coverWidth: number;
  coverHeight: number;
  photoCount: number;
  photoIds: string[];
  camera?: string;
  cameraType?: "135" | "120" | "digital";
  lens?: string;
  film?: string;
  filmBrand?: string;
  iso?: number;
  takenAt?: string;
  date?: string;
  location?: string;
  owner: Uploader;
  visibility: Visibility;
  createdAt: string;
};

export type Series = Album;

export type FilmStock = {
  brand: string;
  name: string;
  iso: number;
  type: "彩色负片" | "黑白负片" | "反转片" | "电影卷";
  formats: string[];
};

export type CameraRecord = {
  brand: string;
  model: string;
  type: "135胶片机" | "120胶片机" | "数码相机";
};

export type LensRecord = {
  brand: string;
  mount: string;
  model: string;
  focalLength?: string;
};

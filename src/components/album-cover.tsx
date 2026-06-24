import type { CSSProperties } from "react";
import { RotatedImage } from "@/components/rotated-image";
import { normalizeRotation, rotatedAspectRatio } from "@/lib/rotation";
import styles from "./album-cover.module.css";

export function AlbumCover({
  src,
  alt,
  rotation,
  width,
  height
}: {
  src: string;
  alt: string;
  rotation?: number;
  width?: number;
  height?: number;
}) {
  const normalizedRotation = normalizeRotation(rotation);
  const aspect = width && height ? rotatedAspectRatio(width, height, normalizedRotation) : null;
  const ratio = aspect ? aspect.width / aspect.height : null;
  const coverStyle =
    ratio && ratio < 1
      ? ({
          width: `min(100%, ${Number((ratio * 70).toFixed(3))}vh)`
        } as CSSProperties)
      : undefined;

  return (
    <RotatedImage
      src={src}
      alt={alt}
      rotation={normalizedRotation}
      width={width}
      height={height}
      fit="cover"
      className={styles.cover}
      style={coverStyle}
    />
  );
}

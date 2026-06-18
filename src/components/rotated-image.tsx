import type { CSSProperties, ImgHTMLAttributes } from "react";
import { isRightAngleRotation, normalizeRotation, rotatedAspectRatio } from "@/lib/rotation";
import styles from "./rotated-image.module.css";

type RotatedImageProps = {
  src: string;
  alt: string;
  rotation?: number;
  width?: number;
  height?: number;
  fit?: "cover" | "contain";
  className?: string;
  imageClassName?: string;
  style?: CSSProperties;
} & Pick<ImgHTMLAttributes<HTMLImageElement>, "loading" | "decoding" | "onLoad" | "onError" | "title">;

export function RotatedImage({
  src,
  alt,
  rotation = 0,
  width,
  height,
  fit = "cover",
  className,
  imageClassName,
  style,
  ...imageProps
}: RotatedImageProps) {
  const normalizedRotation = normalizeRotation(rotation);
  const aspect = width && height ? rotatedAspectRatio(width, height, normalizedRotation) : null;
  const imageWidth = width && height && isRightAngleRotation(normalizedRotation) ? `${(width / height) * 100}%` : "100%";
  const imageHeight = width && height && isRightAngleRotation(normalizedRotation) ? `${(height / width) * 100}%` : "100%";
  const frameStyle = {
    ...style,
    ...(aspect ? { aspectRatio: `${aspect.width} / ${aspect.height}` } : null),
    "--image-height": imageHeight,
    "--image-width": imageWidth,
    "--rotation": `${normalizedRotation}deg`
  } as CSSProperties;

  return (
    <span className={`${styles.frame} ${fit === "contain" ? styles.contain : ""} ${className ?? ""}`} style={frameStyle}>
      <img className={`${styles.image} ${imageClassName ?? ""}`} src={src} alt={alt} {...imageProps} />
    </span>
  );
}

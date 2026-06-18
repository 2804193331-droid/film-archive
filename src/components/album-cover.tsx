import { RotatedImage } from "@/components/rotated-image";
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
  return (
    <div className={styles.cover}>
      <RotatedImage src={src} alt={alt} rotation={rotation} width={width} height={height} fit="cover" className={styles.media} />
    </div>
  );
}

import styles from "./album-cover.module.css";

export function AlbumCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={styles.cover}>
      <img src={src} alt={alt} />
    </div>
  );
}

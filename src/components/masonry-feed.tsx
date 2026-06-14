"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Photo } from "@/lib/types";
import { PhotoCard } from "@/components/photo-card";
import styles from "./masonry-feed.module.css";

const PAGE_SIZE = 9;

export function MasonryFeed({ photos }: { photos: Photo[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible((count) => Math.min(count + PAGE_SIZE, photos.length));
        }
      },
      { rootMargin: "600px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [photos.length]);

  const visiblePhotos = useMemo(() => photos.slice(0, visible), [photos, visible]);

  if (!photos.length) {
    return (
      <div className={styles.empty}>
        <p>没有找到匹配的照片。</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.grid}>
        {visiblePhotos.map((photo) => (
          <PhotoCard key={photo.id} photo={photo} />
        ))}
      </div>
      <div ref={sentinel} className={styles.sentinel} aria-hidden />
    </>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Film, ImageOff, UserRound } from "lucide-react";
import { RotatedImage } from "@/components/rotated-image";
import type { Photo } from "@/lib/types";
import styles from "./photo-card.module.css";

export function PhotoCard({ photo }: { photo: Photo }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ownerHref = `/users/${encodeURIComponent(photo.uploader.id || photo.uploader.username)}`;

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "80px" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link className={styles.imageLink} href={`/photos/${photo.id}`} aria-label={`查看 ${photo.title}`}>
        {!loaded && !failed ? <span className={styles.skeleton} aria-hidden /> : null}
        {failed ? (
          <span className={styles.fallback}>
            <ImageOff size={20} aria-hidden />
            <span>影像暂不可用</span>
          </span>
        ) : (
          <RotatedImage
            src={photo.thumbnailUrl}
            alt={photo.title}
            rotation={photo.rotation}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(true);
              setFailed(true);
            }}
            className={styles.media}
          />
        )}
      </Link>
      <div className={styles.body}>
        <Link href={`/photos/${photo.id}`} className={styles.title}>
          {photo.title}
        </Link>

        <div className={styles.meta}>
          {photo.camera ? (
            <span>
              <Camera size={14} aria-hidden />
              {photo.camera}
            </span>
          ) : null}
          {photo.film ? (
            <span>
              <Film size={14} aria-hidden />
              {photo.film}
            </span>
          ) : null}
          <Link href={ownerHref} className={styles.ownerLink}>
            {photo.uploader.avatarUrl ? <img src={photo.uploader.avatarUrl} alt="" loading="lazy" /> : <UserRound size={14} aria-hidden />}
            {photo.uploader.displayName}
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

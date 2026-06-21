"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Camera, Film, ImageOff, Images, UserRound } from "lucide-react";
import { RotatedImage } from "@/components/rotated-image";
import type { Album } from "@/lib/types";
import styles from "./album-card.module.css";

export function AlbumCard({ album, children }: { album: Album; children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ownerHref = `/users/${encodeURIComponent(album.owner.id || album.owner.username)}`;

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "80px" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link className={styles.cover} href={`/album/${album.id}`} aria-label={`查看 ${album.title}`}>
        {!loaded && !failed ? <span className={styles.skeleton} aria-hidden /> : null}
        {failed ? (
          <span className={styles.fallback}>
            <ImageOff size={20} aria-hidden />
            <span>影像暂不可用</span>
          </span>
        ) : (
          <RotatedImage
            src={album.coverUrl}
            alt={album.title}
            rotation={album.coverRotation}
            width={album.coverWidth}
            height={album.coverHeight}
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
        <div className={styles.titleRow}>
          <Link href={`/album/${album.id}`} className={styles.title}>
            {album.title}
          </Link>
          <span className={styles.count} title={`${album.photoCount} 张照片`}>
            <Images size={13} aria-hidden />
            {album.photoCount}
          </span>
          {children ? <div className={styles.actions}>{children}</div> : null}
        </div>

        <div className={styles.meta}>
          {album.camera ? (
            <span title={album.camera}>
              <Camera size={14} aria-hidden />
              {album.camera}
            </span>
          ) : null}
          {album.film ? (
            <span title={album.film}>
              <Film size={14} aria-hidden />
              {album.film}
            </span>
          ) : null}
          {album.date || album.takenAt ? (
            <span>
              <CalendarDays size={14} aria-hidden />
              {album.date ?? album.takenAt?.slice(0, 10)}
            </span>
          ) : null}
        </div>

        <Link href={ownerHref} className={styles.ownerLink}>
          {album.owner.avatarUrl ? <img src={album.owner.avatarUrl} alt="" loading="lazy" /> : <UserRound size={14} aria-hidden />}
          {album.owner.displayName}
        </Link>
      </div>
    </motion.article>
  );
}

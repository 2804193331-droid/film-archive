"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { Camera, Film, Images, UserRound } from "lucide-react";
import { RotatedImage } from "@/components/rotated-image";
import type { Album } from "@/lib/types";
import styles from "./album-card.module.css";

export function AlbumCard({ album, children }: { album: Album; children?: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const ownerHref = `/users/${encodeURIComponent(album.owner.id || album.owner.username)}`;

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "80px" }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ scale: 1.02 }}
    >
      <Link className={styles.cover} href={`/album/${album.id}`} aria-label={`查看 ${album.title}`}>
        {!loaded ? <span className={styles.skeleton} aria-hidden /> : null}
        <RotatedImage
          src={album.coverUrl}
          alt={album.title}
          rotation={album.coverRotation}
          width={album.coverWidth}
          height={album.coverHeight}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={styles.media}
          imageClassName={loaded ? styles.loaded : ""}
        />
      </Link>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Link href={`/album/${album.id}`} className={styles.title}>
            {album.title}
          </Link>
          {children ? <div className={styles.actions}>{children}</div> : null}
        </div>

        <div className={styles.meta}>
          {album.camera ? (
            <span>
              <Camera size={14} aria-hidden />
              {album.camera}
            </span>
          ) : null}
          {album.film ? (
            <span>
              <Film size={14} aria-hidden />
              {album.film}
            </span>
          ) : null}
          <Link href={ownerHref} className={styles.ownerLink}>
            {album.owner.avatarUrl ? <img src={album.owner.avatarUrl} alt="" loading="lazy" /> : <UserRound size={14} aria-hidden />}
            {album.owner.displayName}
          </Link>
          {album.photoCount > 1 ? (
            <span>
              <Images size={14} aria-hidden />
              {album.photoCount} 张
            </span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

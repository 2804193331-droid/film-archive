import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Camera, Film, Images, MapPin } from "lucide-react";
import { AlbumCover } from "@/components/album-cover";
import { MasonryFeed } from "@/components/masonry-feed";
import { getAlbum, getAlbumPhotos } from "@/lib/photos";
import styles from "./page.module.css";

export default async function AlbumDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [album, photos] = await Promise.all([getAlbum(id), getAlbumPhotos(id)]);

  if (!album) {
    notFound();
  }

  const ownerHref = `/users/${encodeURIComponent(album.owner.id || album.owner.username)}`;

  return (
    <main className="page-shell">
      <section className={styles.hero}>
        <AlbumCover
          src={album.coverUrl}
          alt={album.title}
          rotation={album.coverRotation}
          width={album.coverWidth}
          height={album.coverHeight}
        />
        <div className={styles.copy}>
          <p>ROLL</p>
          <h1>{album.title}</h1>
          <Link className={styles.ownerLink} href={ownerHref}>
            {album.owner.displayName}
          </Link>
          {album.description ? <p>{album.description}</p> : null}
          <div className={styles.meta}>
            <span>
              <Images size={15} aria-hidden />
              {album.photoCount} 张照片
            </span>
            {album.camera ? (
              <span>
                <Camera size={15} aria-hidden />
                {album.camera}
              </span>
            ) : null}
            {album.film ? (
              <span>
                <Film size={15} aria-hidden />
                {album.film}
              </span>
            ) : null}
            {album.date || album.takenAt ? (
              <span>
                <CalendarDays size={15} aria-hidden />
                {album.date ?? album.takenAt?.slice(0, 10)}
              </span>
            ) : null}
            {album.location ? (
              <span>
                <MapPin size={15} aria-hidden />
                {album.location}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <MasonryFeed photos={photos} />
    </main>
  );
}

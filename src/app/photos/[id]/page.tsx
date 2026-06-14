import Link from "next/link";
import { notFound } from "next/navigation";
import { Aperture, CalendarDays, Camera, Film, MapPin, UserRound } from "lucide-react";
import { PhotoActions } from "@/components/photo-actions";
import { PhotoViewer } from "@/components/photo-viewer";
import { getAlbum, getPhoto } from "@/lib/photos";
import styles from "./page.module.css";

export default async function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await getPhoto(id);
  if (!photo) {
    notFound();
  }

  const album = photo.albumId ? await getAlbum(photo.albumId) : null;
  const downloadUrl = photo.originalUrl;
  const ownerHref = `/users/${encodeURIComponent(photo.uploader.id || photo.uploader.username)}`;

  const details = [
    { label: "相机", value: photo.camera, icon: Camera },
    { label: "镜头", value: photo.lens, icon: Aperture },
    { label: "胶卷", value: photo.film, icon: Film },
    { label: "ISO", value: photo.iso ? `ISO ${photo.iso}` : undefined, icon: Film },
    { label: "日期", value: photo.takenAt, icon: CalendarDays },
    { label: "地点", value: photo.location, icon: MapPin }
  ];

  return (
    <main className="page-shell">
      <section className={styles.layout}>
        <PhotoViewer src={photo.previewUrl} alt={photo.title} />

        <aside className={styles.sidebar}>
          <div>
            <h1>{photo.title}</h1>
            <Link href={ownerHref} className={styles.uploader}>
              {photo.uploader.avatarUrl ? <img src={photo.uploader.avatarUrl} alt="" /> : <UserRound size={18} aria-hidden />}
              <span>{photo.uploader.displayName}</span>
            </Link>
          </div>

          <PhotoActions downloadUrl={downloadUrl} />

          <dl className={styles.details}>
            {details.map((item) => {
              if (!item.value) return null;
              const Icon = item.icon;
              return (
                <div key={item.label}>
                  <dt>
                    <Icon size={15} aria-hidden />
                    {item.label}
                  </dt>
                  <dd>{item.value}</dd>
                </div>
              );
            })}
          </dl>

          {album ? (
            <Link className={styles.seriesLink} href={`/album/${album.id}`}>
              收录于《{album.title}》
            </Link>
          ) : null}

          {photo.notes ? (
            <div className={styles.notes}>
              <h2>备注</h2>
              <p>{photo.notes}</p>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { AlbumCard } from "@/components/album-card";
import { DeleteAlbumButton } from "@/components/delete-album-button";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import { getAlbumsForUser } from "@/lib/photos";
import styles from "./page.module.css";

export default async function MyPhotosPage() {
  const session = await getAppSessionFromServerCookies();
  if (!session) {
    redirect("/login");
  }

  const albums = await getAlbumsForUser(session.id);

  return (
    <main className="page-shell">
      <section className={styles.header}>
        <p>MY WORKS</p>
        <h1>我的照片</h1>
        <Link className="button" href="/upload">
          去上传
        </Link>
      </section>

      {albums.length ? (
        <section className={styles.grid}>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album}>
              <Link className="ghost-button" href={`/my/photos/${album.id}/edit`}>
                <Pencil size={15} aria-hidden />
                编辑
              </Link>
              <DeleteAlbumButton albumId={album.id} title={album.title} />
            </AlbumCard>
          ))}
        </section>
      ) : (
        <section className={styles.empty}>
          <p>你还没有上传作品</p>
          <Link className="button" href="/upload">
            去上传
          </Link>
        </section>
      )}
    </main>
  );
}

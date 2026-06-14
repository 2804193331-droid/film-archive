import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditAlbumForm } from "@/components/edit-album-form";
import { isAdminUser } from "@/lib/admin";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import { getAlbum } from "@/lib/photos";
import styles from "./page.module.css";

export default async function EditMyAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAppSessionFromServerCookies();
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const album = await getAlbum(id);
  if (!album) {
    notFound();
  }

  if (album.userId !== session.id && !isAdminUser(session.id, session.username)) {
    redirect("/my/photos");
  }

  return (
    <main className="page-shell">
      <section className={styles.header}>
        <p>EDIT</p>
        <h1>编辑作品</h1>
        <Link className="ghost-button" href="/my/photos">
          返回我的照片
        </Link>
      </section>

      <EditAlbumForm album={album} />
    </main>
  );
}

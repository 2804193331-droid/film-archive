import { MasonryFeed } from "@/components/masonry-feed";
import { getPhotos, getUser } from "@/lib/photos";
import styles from "./page.module.css";

export default async function UserPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const [user, photos] = await Promise.all([getUser(username), getPhotos()]);
  const userPhotos = photos.filter((photo) => photo.uploader.username === user.username || photo.uploader.id === user.id);

  return (
    <main className="page-shell">
      <section className={styles.profile}>
        {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : null}
        <div>
          <p>@{user.username}</p>
          <h1>{user.displayName}</h1>
          <span>{userPhotos.length} 张公开作品</span>
        </div>
      </section>

      <MasonryFeed photos={userPhotos} />
    </main>
  );
}

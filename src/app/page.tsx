import { redirect } from "next/navigation";
import { AlbumFeed } from "@/components/album-feed";
import { getAlbums } from "@/lib/photos";
import { getStorageStatus } from "@/lib/storage";
import styles from "./page.module.css";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    film?: string;
    camera?: string;
    lens?: string;
    iso?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const storage = await getStorageStatus();
  if (!storage.configured) {
    redirect("/setup");
  }

  const filters = await searchParams;
  const albums = await getAlbums(filters);

  return (
    <main className={`page-shell ${styles.home}`}>
      <AlbumFeed albums={albums} />
    </main>
  );
}

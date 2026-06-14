import { AlbumFeed } from "@/components/album-feed";
import { getAlbums } from "@/lib/photos";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

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
  const filters = await searchParams;
  const albums = await getAlbums(filters);

  return (
    <main className={`page-shell ${styles.home}`}>
      <AlbumFeed albums={albums} />
    </main>
  );
}

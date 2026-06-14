import Link from "next/link";
import { Images, MapPin } from "lucide-react";
import type { Series } from "@/lib/types";
import styles from "./series-card.module.css";

export function SeriesCard({ series }: { series: Series }) {
  return (
    <article className={styles.card}>
      <Link href={`/series/${series.id}`} className={styles.cover}>
        <img src={series.coverUrl} alt={series.title} loading="lazy" />
      </Link>
      <div className={styles.body}>
        <Link href={`/series/${series.id}`} className={styles.title}>
          {series.title}
        </Link>
        <p>{series.description}</p>
        <div className={styles.meta}>
          <span>
            <Images size={15} aria-hidden />
            {series.photoIds.length} 张
          </span>
          {series.location ? (
            <span>
              <MapPin size={15} aria-hidden />
              {series.location}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

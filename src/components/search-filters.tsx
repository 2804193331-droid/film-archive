import { SlidersHorizontal } from "lucide-react";
import { cameras, films, lenses } from "@/lib/catalog";
import styles from "./search-filters.module.css";

type SearchFiltersProps = {
  q?: string;
  film?: string;
  camera?: string;
  lens?: string;
  iso?: string;
};

export function SearchFilters({ q, film, camera, lens, iso }: SearchFiltersProps) {
  const isoValues = Array.from(new Set(films.map((item) => item.iso))).sort((a, b) => a - b);

  return (
    <form className={styles.filters} action="/">
      <div className={styles.label}>
        <SlidersHorizontal size={17} aria-hidden />
        筛选
      </div>

      <input className="input" name="q" defaultValue={q} placeholder="关键词" />

      <input className="input" name="film" list="filter-film-list" defaultValue={film} placeholder="胶片" />
      <input className="input" name="camera" list="filter-camera-list" defaultValue={camera} placeholder="相机" />
      <input className="input" name="lens" list="filter-lens-list" defaultValue={lens} placeholder="镜头" />

      <select className="select" name="iso" defaultValue={iso ?? ""} aria-label="ISO">
        <option value="">ISO</option>
        {isoValues.map((value) => (
          <option key={value} value={value}>
            ISO {value}
          </option>
        ))}
      </select>

      <button className="button" type="submit">
        应用
      </button>

      <datalist id="filter-film-list">
        {films.map((item) => (
          <option key={`${item.brand}-${item.name}`} value={`${item.brand} ${item.name}`} />
        ))}
      </datalist>
      <datalist id="filter-camera-list">
        {cameras.map((item) => (
          <option key={`${item.brand}-${item.model}`} value={`${item.brand} ${item.model}`} />
        ))}
      </datalist>
      <datalist id="filter-lens-list">
        {lenses.map((item) => (
          <option key={`${item.mount}-${item.model}`} value={`${item.brand} ${item.model}`} />
        ))}
      </datalist>
    </form>
  );
}

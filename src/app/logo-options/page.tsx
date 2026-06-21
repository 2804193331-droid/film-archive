import { Aperture, Film, Flower2, Focus } from "lucide-react";
import { SakuraLogo } from "@/components/sakura-logo";
import styles from "./page.module.css";

const concepts = [
  { id: "01", name: "樱花光圈", tone: "柔和、完整，适合社区主品牌" },
  { id: "02", name: "单线樱花", tone: "轻盈、克制，适合极简摄影站" },
  { id: "03", name: "花瓣快门", tone: "更像相机标志，摄影属性更强" },
  { id: "04", name: "胶片花窗", tone: "胶片感明确，识别度更直接" },
  { id: "05", name: "FA 花印", tone: "偏编辑杂志，适合作品档案馆" },
  { id: "06", name: "对焦樱印", tone: "冷静、现代，适合工具与社区并存" }
];

export default function LogoOptionsPage() {
  return (
    <main className="page-shell">
      <header className={styles.header}>
        <p>SAKURA IDENTITY STUDY</p>
        <h1>Film Archive 标志方案</h1>
        <span>当前使用 01，记住你喜欢的编号。</span>
      </header>

      <section className={styles.grid} aria-label="樱花 Logo 方案">
        {concepts.map((concept, index) => (
          <article className={styles.card} key={concept.id}>
            <div className={styles.canvas}>
              {index === 0 ? <SakuraLogo size="large" /> : null}
              {index === 1 ? (
                <span className={`${styles.iconMark} ${styles.outlineFlower}`}>
                  <Flower2 size={112} strokeWidth={1.15} aria-hidden />
                </span>
              ) : null}
              {index === 2 ? (
                <span className={`${styles.iconMark} ${styles.shutterMark}`}>
                  <Aperture size={106} strokeWidth={1.25} aria-hidden />
                  <i />
                </span>
              ) : null}
              {index === 3 ? (
                <span className={`${styles.iconMark} ${styles.filmMark}`}>
                  <Film size={114} strokeWidth={1.1} aria-hidden />
                  <Flower2 size={46} strokeWidth={1.5} aria-hidden />
                </span>
              ) : null}
              {index === 4 ? (
                <span className={`${styles.iconMark} ${styles.monogramMark}`}>
                  <strong>FA</strong>
                  <i />
                </span>
              ) : null}
              {index === 5 ? (
                <span className={`${styles.iconMark} ${styles.focusMark}`}>
                  <Focus size={118} strokeWidth={1} aria-hidden />
                  <Flower2 size={48} strokeWidth={1.4} aria-hidden />
                </span>
              ) : null}
            </div>
            <div className={styles.caption}>
              <span>{concept.id}</span>
              <div>
                <h2>{concept.name}</h2>
                <p>{concept.tone}</p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

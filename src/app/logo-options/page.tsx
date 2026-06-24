import { SakuraLogo } from "@/components/sakura-logo";
import styles from "./page.module.css";

const schemes = [
  {
    id: "01",
    name: "胶片花环",
    badge: "当前推荐",
    mood: "最克制，适合正式站。胶片环负责识别，樱花只做轻柔记忆点。",
    className: "schemeBloom",
    points: ["圆形胶片环", "樱花旋转打开", "背景装饰最淡"]
  },
  {
    id: "02",
    name: "樱花片窗",
    badge: "更像画册",
    mood: "更偏作品集，像从胶片片窗里看照片，樱花只留在角落。",
    className: "schemeWindow",
    points: ["胶片片窗", "画册式留白", "照片边界更干净"]
  },
  {
    id: "03",
    name: "镜头樱印",
    badge: "更像相机品牌",
    mood: "更现代，标志像镜头光圈和樱花印章组合，后台和工具页会更稳。",
    className: "schemeLens",
    points: ["镜头光圈", "单瓣樱花印", "质感更科技"]
  }
];

export default function LogoOptionsPage() {
  return (
    <main className={`page-shell ${styles.page}`}>
      <header className={styles.header}>
        <p>SAKURA FILM IDENTITY</p>
        <h1>三套胶片樱花视觉方案</h1>
        <span>先看整体气质，选一个编号，我再把全站固定到那套。</span>
      </header>

      <section className={styles.grid} aria-label="胶片樱花视觉方案">
        {schemes.map((scheme) => (
          <article className={`${styles.card} ${styles[scheme.className]}`} key={scheme.id}>
            <div className={styles.cardHeader}>
              <span>{scheme.id}</span>
              <strong>{scheme.name}</strong>
              <em>{scheme.badge}</em>
            </div>

            <div className={styles.logoStage}>
              {scheme.id === "01" ? (
                <div className={styles.logoLockup}>
                  <SakuraLogo size="large" animate />
                  <div>
                    <strong>Film Archive</strong>
                    <small>SAKURA FILM</small>
                  </div>
                </div>
              ) : null}

              {scheme.id === "02" ? (
                <div className={`${styles.conceptLogo} ${styles.windowLogo}`} aria-hidden>
                  <i className={styles.windowPetalOne} />
                  <i className={styles.windowPetalTwo} />
                  <span>FA</span>
                </div>
              ) : null}

              {scheme.id === "03" ? (
                <div className={`${styles.conceptLogo} ${styles.lensLogo}`} aria-hidden>
                  <i className={styles.lensBladeOne} />
                  <i className={styles.lensBladeTwo} />
                  <i className={styles.lensBladeThree} />
                  <span />
                </div>
              ) : null}
            </div>

            <div className={styles.mockSite} aria-hidden>
              <div className={styles.mockNav}>
                <span />
                <i />
                <i />
              </div>
              <div className={styles.mockBody}>
                <div className={styles.mockPhoto} />
                <div className={styles.mockStack}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>

            <div className={styles.copy}>
              <p>{scheme.mood}</p>
              <div className={styles.tags}>
                {scheme.points.map((point) => (
                  <span key={point}>{point}</span>
                ))}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

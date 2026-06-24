import styles from "./sakura-logo.module.css";

type SakuraLogoProps = {
  size?: "small" | "large";
  showName?: boolean;
  animate?: boolean;
};

export function SakuraLogo({ size = "large", showName = false, animate = false }: SakuraLogoProps) {
  return (
    <div
      className={`${styles.logo} ${size === "small" ? styles.small : styles.large} ${animate ? styles.animated : ""}`}
      aria-label={showName ? "Film Archive" : undefined}
    >
      <span className={styles.mark} aria-hidden>
        <i className={`${styles.petal} ${styles.petalOne}`} />
        <i className={`${styles.petal} ${styles.petalTwo}`} />
        <i className={`${styles.petal} ${styles.petalThree}`} />
        <i className={`${styles.petal} ${styles.petalFour}`} />
        <i className={`${styles.petal} ${styles.petalFive}`} />
        <i className={styles.center} />
      </span>
      {showName ? (
        <span className={styles.wordmark}>
          <strong>Film Archive</strong>
          <small>SAKURA FILM COMMUNITY</small>
        </span>
      ) : null}
    </div>
  );
}

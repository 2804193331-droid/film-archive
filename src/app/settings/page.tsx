import Link from "next/link";
import { Cloud } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <main className="page-shell">
      <section className={styles.header}>
        <p>SETTINGS</p>
        <h1 className="section-title">设置</h1>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <div>
            <p className={styles.kicker}>外观</p>
            <h2>主题模式</h2>
            <p className={styles.description}>选择浅色、深色，或者跟随系统。</p>
          </div>
          <ThemeSwitcher />
        </section>

        <Link className={styles.panelLink} href="/settings/storage">
          <div>
            <p className={styles.kicker}>OSS</p>
            <h2>阿里云 OSS</h2>
            <p className={styles.description}>查看当前对象存储配置状态。</p>
          </div>
          <Cloud size={22} aria-hidden />
        </Link>
      </div>
    </main>
  );
}

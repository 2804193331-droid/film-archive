import Link from "next/link";
import { HardDrive } from "lucide-react";
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
            <p className={styles.kicker}>存储</p>
            <h2>存储管理</h2>
            <p className={styles.description}>查看硬盘状态、修复缩略图、重新扫描目录。</p>
          </div>
          <HardDrive size={22} aria-hidden />
        </Link>
      </div>
    </main>
  );
}

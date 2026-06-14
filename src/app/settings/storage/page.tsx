import { redirect } from "next/navigation";
import { StorageManager } from "@/components/storage-manager";
import { canManageStorage } from "@/lib/admin";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import styles from "./page.module.css";

export default async function StorageSettingsPage() {
  const session = await getAppSessionFromServerCookies();
  if (!canManageStorage(session)) {
    redirect(session ? "/settings" : "/login");
  }

  return (
    <main className="page-shell">
      <section className={styles.header}>
        <p>STORAGE</p>
        <h1 className="section-title">存储管理</h1>
      </section>
      <StorageManager />
    </main>
  );
}

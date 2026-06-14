import { redirect } from "next/navigation";
import { StorageSetup } from "@/components/storage-setup";
import { canManageStorage } from "@/lib/admin";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import styles from "./page.module.css";

export default async function SetupPage() {
  const session = await getAppSessionFromServerCookies();
  if (!canManageStorage(session)) {
    redirect(session ? "/" : "/login");
  }

  return (
    <main className="page-shell">
      <section className={styles.layout}>
        <div>
          <p>FIRST RUN</p>
          <h1>选择照片存储硬盘，Film Archive 会自动创建四个目录。</h1>
          <ul>
            <li>originals：原图</li>
            <li>previews：详情页预览图</li>
            <li>thumbnails：首页缩略图</li>
            <li>backup：备份</li>
          </ul>
        </div>
        <StorageSetup />
      </section>
    </main>
  );
}

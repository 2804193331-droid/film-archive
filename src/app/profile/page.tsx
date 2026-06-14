import Link from "next/link";
import { redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import styles from "./page.module.css";

export default async function ProfilePage() {
  const session = await getAppSessionFromServerCookies();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="page-shell">
      <section className={styles.layout}>
        <div className={styles.card}>
          <div className={styles.avatar}>
            {session.avatarUrl ? <img src={session.avatarUrl} alt="" /> : <UserRound size={44} aria-hidden />}
          </div>
          <div>
            <p>PROFILE</p>
            <h1>{session.displayName}</h1>
            <span>@{session.username}</span>
          </div>
        </div>

        <div className={styles.panel}>
          <dl className={styles.facts}>
            <div>
              <dt>用户名</dt>
              <dd>{session.username}</dd>
            </div>
            <div>
              <dt>注册时间</dt>
              <dd>{formatDate(session.createdAt)}</dd>
            </div>
          </dl>

          <ProfileForm displayName={session.displayName} avatarUrl={session.avatarUrl} />

          <Link className="ghost-button" href="/my/photos">
            查看我的作品
          </Link>
        </div>
      </section>
    </main>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

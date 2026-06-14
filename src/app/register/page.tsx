import { AuthForm } from "@/components/auth-form";
import styles from "../login/page.module.css";

export default function RegisterPage() {
  return (
    <main className="page-shell">
      <section className={styles.authPage}>
        <div>
          <p>JOIN FILM ARCHIVE</p>
          <h1>创建账号，把你的胶片作品归档到社区。</h1>
        </div>
        <AuthForm mode="register" />
      </section>
    </main>
  );
}

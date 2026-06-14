import { AuthForm } from "@/components/auth-form";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className={styles.authPage}>
        <div>
          <p>WELCOME BACK</p>
          <h1>登录后上传、编辑和管理自己的照片。</h1>
        </div>
        <AuthForm mode="login" />
      </section>
    </main>
  );
}

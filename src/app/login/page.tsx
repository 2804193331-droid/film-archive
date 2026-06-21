import { AuthForm } from "@/components/auth-form";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <main className="page-shell">
      <section className={styles.authPage}>
        <AuthBrandPanel />
        <AuthForm mode="login" />
      </section>
    </main>
  );
}

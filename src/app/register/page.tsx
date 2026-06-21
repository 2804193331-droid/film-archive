import { AuthForm } from "@/components/auth-form";
import { AuthBrandPanel } from "@/components/auth-brand-panel";
import styles from "../login/page.module.css";

export default function RegisterPage() {
  return (
    <main className="page-shell">
      <section className={styles.authPage}>
        <AuthBrandPanel />
        <AuthForm mode="register" />
      </section>
    </main>
  );
}

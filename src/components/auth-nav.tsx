"use client";

import Link from "next/link";
import { LogIn, Settings, Shield, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./auth-nav.module.css";

type AuthState = {
  displayName?: string;
  avatarUrl?: string;
  isAdmin?: boolean;
};

export function AuthNav() {
  const [state, setState] = useState<AuthState>({});

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!mounted) return;
        setState({
          displayName: body.user?.displayName,
          avatarUrl: body.user?.avatarUrl,
          isAdmin: Boolean(body.isAdmin)
        });
      })
      .catch(() => {
        if (mounted) setState({});
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setState({});
    window.location.href = "/";
  }

  if (state.displayName) {
    return (
      <nav className={styles.nav} aria-label="用户导航">
        <Link className={styles.avatarLink} href="/profile">
          {state.avatarUrl ? <img src={state.avatarUrl} alt="" /> : <UserRound size={18} aria-hidden />}
          <span>{state.displayName}</span>
        </Link>
        <Link className={`${styles.compactLink} ${styles.sessionLink}`} href="/my/photos">
          我的照片
        </Link>
        {state.isAdmin ? (
          <Link className={`${styles.compactLink} ${styles.sessionLink}`} href="/admin">
            <Shield size={16} aria-hidden />
            后台
          </Link>
        ) : null}
        <Link className={styles.iconLink} href="/settings" title="设置">
          <Settings size={18} aria-hidden />
          <span className="sr-only">设置</span>
        </Link>
        <button className={styles.compactButton} type="button" onClick={logout}>
          退出登录
        </button>
      </nav>
    );
  }

  return (
    <nav className={styles.nav} aria-label="登录注册">
      <Link className={styles.compactLink} href="/login">
        <LogIn size={17} aria-hidden />
        登录
      </Link>
      <Link className={styles.registerLink} href="/register">
        注册
      </Link>
    </nav>
  );
}

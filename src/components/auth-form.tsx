"use client";

import Link from "next/link";
import { useState } from "react";
import { isValidUsername, normalizeUsername, usernameHelpText } from "@/lib/auth-identity";
import styles from "./auth-form.module.css";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidUsername(username)) {
      setMessage(usernameHelpText);
      return;
    }

    setBusy(true);
    setMessage("");

    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: normalizeUsername(username),
        password
      })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? (mode === "register" ? "注册失败，请稍后重试。" : "登录失败，请稍后重试。"));
      return;
    }

    setMessage(mode === "register" ? "注册成功，已登录。" : "登录成功。");
    window.location.href = "/";
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <header className={styles.header}>
        <span>{mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}</span>
        <h1>{mode === "login" ? "登录 Film Archive" : "加入 Film Archive"}</h1>
      </header>

      <label>
        用户名
        <input
          className="input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="filmuser"
          autoComplete="username"
          required
        />
      </label>

      <label>
        密码
        <input
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={6}
        />
      </label>

      <p className={styles.hint}>{usernameHelpText}</p>

      <button className="button" type="submit" disabled={busy}>
        {busy ? "处理中..." : mode === "login" ? "登录" : "注册"}
      </button>

      {message ? <p className={styles.message}>{message}</p> : null}

      {mode === "login" ? (
        <p className={styles.switch}>
          没有账号？<Link href="/register">注册</Link>
        </p>
      ) : (
        <p className={styles.switch}>
          已有账号？<Link href="/login">登录</Link>
        </p>
      )}
    </form>
  );
}

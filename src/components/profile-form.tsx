"use client";

import { Camera, LogOut, Save, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./profile-form.module.css";

export function ProfileForm({
  displayName,
  avatarUrl
}: {
  displayName: string;
  avatarUrl?: string;
}) {
  const [name, setName] = useState(displayName);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(avatarUrl ?? "");
      return;
    }

    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile, avatarUrl]);

  async function save() {
    setBusy(true);
    setMessage("");

    const payload = new FormData();
    payload.append("displayName", name);
    if (avatarUrl) {
      payload.append("keepAvatarUrl", avatarUrl);
    }
    if (avatarFile) {
      payload.append("avatar", avatarFile);
    }

    const response = await fetch("/api/profile", {
      method: "PATCH",
      body: payload
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? "保存失败。");
      return;
    }

    setMessage("已保存。");
    window.setTimeout(() => window.location.reload(), 500);
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    window.location.href = "/";
  }

  return (
    <div className={styles.form}>
      <label>
        昵称
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </label>

      <div className={styles.avatarPicker}>
        <div className={styles.avatarPreview}>
          {avatarPreview ? <img src={avatarPreview} alt="" /> : <UserRound size={34} aria-hidden />}
        </div>
        <label className="ghost-button">
          <Camera size={17} aria-hidden />
          更换头像
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/tiff"
            disabled={busy}
            onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}

      <div className={styles.actions}>
        <button className="button" type="button" disabled={busy} onClick={save}>
          <Save size={17} aria-hidden />
          {busy ? "保存中" : "保存资料"}
        </button>
        <button className="ghost-button" type="button" onClick={logout}>
          <LogOut size={17} aria-hidden />
          退出登录
        </button>
      </div>
    </div>
  );
}

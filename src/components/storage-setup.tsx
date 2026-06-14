"use client";

import { useRouter } from "next/navigation";
import { HardDrive, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./storage-setup.module.css";

type CandidateResponse = {
  candidates: string[];
};

export function StorageSetup({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCandidates() {
    const response = await fetch("/api/storage/candidates", { cache: "no-store" });
    const data = (await response.json()) as CandidateResponse;
    setCandidates(data.candidates);
    setSelected((current) => current || data.candidates[0] || "");
  }

  useEffect(() => {
    loadCandidates().catch(() => setCandidates([]));
  }, []);

  async function save() {
    const uploadDir = custom.trim() || selected;
    if (!uploadDir) {
      setMessage("请选择或输入一个存储目录。");
      return;
    }

    setBusy(true);
    setMessage("");

    const response = await fetch("/api/storage/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadDir })
    });

    const body = await response.json();
    setBusy(false);

    if (!response.ok) {
      setMessage(body.error ?? "保存失败。");
      return;
    }

    setMessage("存储目录已配置，正在进入首页。");
    router.push("/");
    router.refresh();
  }

  return (
    <section className={compact ? styles.compact : styles.setup}>
      <div className={styles.candidates}>
        {candidates.map((candidate) => (
          <button
            key={candidate}
            className={selected === candidate && !custom ? styles.selectedDrive : styles.drive}
            type="button"
            onClick={() => {
              setSelected(candidate);
              setCustom("");
            }}
          >
            <HardDrive size={19} aria-hidden />
            <span>{candidate}</span>
          </button>
        ))}
      </div>

      <label className={styles.custom}>
        自定义目录
        <input
          className="input"
          value={custom}
          onChange={(event) => setCustom(event.target.value)}
          placeholder="例如 D:\\PhotoArchive 或 /Volumes/FilmDisk/PhotoArchive"
        />
      </label>

      <div className={styles.actions}>
        <button className="ghost-button" type="button" onClick={loadCandidates}>
          <RefreshCcw size={17} aria-hidden />
          重新检测
        </button>
        <button className="button" type="button" onClick={save} disabled={busy}>
          {busy ? "正在创建目录..." : "使用此位置"}
        </button>
      </div>

      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}

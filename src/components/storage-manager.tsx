"use client";

import { CheckCircle2, Database, HardDrive, Image, RefreshCcw, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { StorageSetup } from "@/components/storage-setup";
import styles from "./storage-manager.module.css";

type StorageStatus = {
  configured: boolean;
  uploadDir?: string;
  online: boolean;
  readOnly: boolean;
  usedBytes: number;
  freeBytes?: number;
  totalBytes?: number;
  imageCount: number;
  missingDirs: string[];
};

export function StorageManager() {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await fetch("/api/storage/status", { cache: "no-store" });
    const data = (await response.json()) as StorageStatus;
    setStatus(data);
    setMessage("目录状态已更新。");
  }

  async function rescan() {
    setMessage("正在重新扫描目录...");
    const response = await fetch("/api/storage/rescan", { method: "POST" });
    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(body.error ?? "重新扫描失败。");
      return;
    }

    await refresh();
    setMessage(`重新扫描完成，恢复了 ${body.recovered ?? 0} 张照片。`);
  }

  useEffect(() => {
    refresh().catch(() => setMessage("无法读取存储状态。"));
  }, []);

  if (!status) {
    return <div className={styles.loading}>正在读取存储状态...</div>;
  }

  const cards = [
    {
      label: "当前存储位置",
      value: status.uploadDir ?? "未配置",
      icon: HardDrive
    },
    {
      label: "在线状态",
      value: status.online ? "在线" : "未连接",
      icon: CheckCircle2
    },
    {
      label: "已使用空间",
      value: formatBytes(status.usedBytes),
      icon: Database
    },
    {
      label: "剩余空间",
      value: formatBytes(status.freeBytes),
      icon: Database
    },
    {
      label: "图片数量",
      value: `${status.imageCount}`,
      icon: Image
    }
  ];

  return (
    <div className={styles.manager}>
      <section className={styles.cards}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className={styles.card}>
              <Icon size={19} aria-hidden />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          );
        })}
      </section>

      {status.missingDirs.length ? (
        <div className={styles.warning}>缺少目录：{status.missingDirs.join("、")}。请重新选择当前存储位置来自动修复。</div>
      ) : null}

      <section className={styles.tools}>
        <button className="ghost-button" type="button" onClick={refresh}>
          <RefreshCcw size={17} aria-hidden />
          测试目录
        </button>
        <button className="ghost-button" type="button" onClick={rescan}>
          <RefreshCcw size={17} aria-hidden />
          重新扫描目录
        </button>
        <button className="ghost-button" type="button" onClick={() => setMessage("缩略图修复任务已预留，接入任务队列后可批量重建。")}>
          <Wrench size={17} aria-hidden />
          修复缩略图
        </button>
        <button className="ghost-button" type="button" onClick={() => setMessage("迁移照片会保留数据库中的相对路径，后续可接入后台复制任务。")}>
          <HardDrive size={17} aria-hidden />
          迁移照片
        </button>
      </section>

      {message ? <p className={styles.message}>{message}</p> : null}

      <section className={styles.replace}>
        <div>
          <h2>更换存储位置</h2>
          <p>数据库只保存 originals/001.jpg 这样的相对路径，所以硬盘路径可以随时替换。</p>
        </div>
        <StorageSetup compact />
      </section>
    </div>
  );
}

function formatBytes(bytes?: number) {
  if (bytes === undefined) return "未知";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[index]}`;
}

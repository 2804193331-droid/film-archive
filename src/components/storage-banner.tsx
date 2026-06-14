"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardDrive, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./storage-banner.module.css";

type Status = {
  configured: boolean;
  online: boolean;
  readOnly: boolean;
  uploadDir?: string;
  missingDirs: string[];
};

export function StorageBanner() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/storage/status", { cache: "no-store" })
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [pathname]);

  if (!status || (status.configured && status.online && !status.readOnly)) {
    return null;
  }

  const copy = !status.configured
    ? "首次使用前需要选择照片存储位置。"
    : status.online
      ? "照片存储目录需要修复，网站已进入只读模式。"
      : "照片存储硬盘未连接，网站已进入只读模式。";

  return (
    <div className={styles.banner}>
      <div className={styles.inner}>
        <span className={styles.icon}>{status.configured ? <TriangleAlert size={18} /> : <HardDrive size={18} />}</span>
        <span>{copy}</span>
        <Link href={status.configured ? "/settings/storage" : "/setup"}>处理存储设置</Link>
      </div>
    </div>
  );
}

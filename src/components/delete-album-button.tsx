"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";

export function DeleteAlbumButton({ albumId, title }: { albumId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function deleteAlbum() {
    if (!window.confirm(`确定删除《${title}》吗？这会同时删除这一组的所有照片文件。`)) {
      return;
    }

    setBusy(true);
    const response = await fetch(`/api/albums/${albumId}`, { method: "DELETE" });
    setBusy(false);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      window.alert(body.error ?? "删除失败，请稍后重试。");
      return;
    }

    router.refresh();
  }

  return (
    <button className="danger-button" type="button" disabled={busy} onClick={deleteAlbum}>
      <Trash2 size={15} aria-hidden />
      {busy ? "删除中" : "删除"}
    </button>
  );
}

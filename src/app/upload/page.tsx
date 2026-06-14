import { UploadDropzone } from "@/components/upload-dropzone";
import { getStorageStatus } from "@/lib/storage";
import styles from "./page.module.css";

export default async function UploadPage() {
  const storage = await getStorageStatus();
  const readOnly = !storage.configured || !storage.online || storage.readOnly;

  return (
    <main className="page-shell">
      <section className={styles.shell}>
        {readOnly ? <div className={styles.notice}>当前存储不可写，请先检查硬盘。</div> : null}
        <UploadDropzone readOnly={readOnly} />
      </section>
    </main>
  );
}

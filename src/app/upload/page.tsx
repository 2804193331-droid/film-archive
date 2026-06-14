import { UploadDropzone } from "@/components/upload-dropzone";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  return (
    <main className="page-shell">
      <section className={styles.shell}>
        <UploadDropzone readOnly={false} />
      </section>
    </main>
  );
}

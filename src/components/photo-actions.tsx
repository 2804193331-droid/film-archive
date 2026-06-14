import { Download } from "lucide-react";
import styles from "./photo-actions.module.css";

export function PhotoActions({ downloadUrl }: { downloadUrl: string }) {
  return (
    <div className={styles.actions}>
      <a className="button" href={downloadUrl} download>
        <Download size={17} aria-hidden />
        下载原图
      </a>
    </div>
  );
}

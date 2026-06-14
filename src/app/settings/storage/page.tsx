import { isOssConfigured, OSS_BUCKET, OSS_ENDPOINT, OSS_REGION } from "@/lib/oss";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default function StorageSettingsPage() {
  const configured = isOssConfigured();

  return (
    <main className="page-shell">
      <section className={styles.header}>
        <p>OSS</p>
        <h1 className="section-title">阿里云 OSS</h1>
      </section>

      <section className={styles.panel}>
        <dl>
          <div>
            <dt>Bucket</dt>
            <dd>{OSS_BUCKET}</dd>
          </div>
          <div>
            <dt>Region</dt>
            <dd>{OSS_REGION}</dd>
          </div>
          <div>
            <dt>Endpoint</dt>
            <dd>{OSS_ENDPOINT}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{configured ? "已配置" : "缺少 AccessKey 环境变量"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

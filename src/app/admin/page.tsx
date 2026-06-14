import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Cloud, Database, ImageIcon, ShieldCheck, UsersRound } from "lucide-react";
import { canAccessAdmin, hasAdminConfig } from "@/lib/admin";
import { getAppSessionFromServerCookies } from "@/lib/app-session";
import { DeleteAlbumButton } from "@/components/delete-album-button";
import { isOssConfigured, OSS_BUCKET, OSS_ENDPOINT, OSS_REGION, publicObjectUrl } from "@/lib/oss";
import { createSupabaseAdminClient } from "@/lib/supabase";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type SupabaseAdmin = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

type RecentAlbum = {
  id: string;
  title: string;
  ownerId?: string;
  visibility?: string;
  createdAt?: string;
  photoCount: number;
};

type RecentPhoto = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
};

type ProfileRow = {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  created_at?: string;
};

export default async function AdminPage() {
  const session = await getAppSessionFromServerCookies();
  if (!session) {
    redirect("/login");
  }

  if (!canAccessAdmin(session)) {
    redirect("/");
  }

  const supabase = createSupabaseAdminClient();
  const [albumsCount, photosCount, usersCount, recentAlbums, recentPhotos, users] = supabase
    ? await Promise.all([
        countRows(supabase, "albums"),
        countRows(supabase, "photos"),
        countRows(supabase, "profiles"),
        readRecentAlbums(supabase),
        readRecentPhotos(supabase),
        readUsers(supabase)
      ])
    : [0, 0, 0, [], [], []];

  const ossReady = isOssConfigured();
  const adminReady = hasAdminConfig() || process.env.NODE_ENV !== "production";

  return (
    <main className="page-shell">
      <section className={styles.header}>
        <div>
          <p>ADMIN</p>
          <h1 className="section-title">后台管理</h1>
        </div>
        <Link className="ghost-button" href="/">
          返回首页
        </Link>
      </section>

      <section className={styles.stats} aria-label="站点概览">
        <StatCard icon={<ImageIcon size={20} aria-hidden />} label="作品组" value={String(albumsCount)} />
        <StatCard icon={<Database size={20} aria-hidden />} label="照片" value={String(photosCount)} />
        <StatCard icon={<UsersRound size={20} aria-hidden />} label="用户" value={String(usersCount)} />
        <StatCard icon={<Cloud size={20} aria-hidden />} label="OSS" value={ossReady ? "已配置" : "未配置"} tone={ossReady ? "ok" : "warn"} />
      </section>

      <section className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>STORAGE</p>
              <h2>上传与存储</h2>
            </div>
            <span className={ossReady ? styles.badgeOk : styles.badgeWarn}>{ossReady ? "可上传" : "不可上传"}</span>
          </div>
          <dl className={styles.configList}>
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
              <dt>AccessKey</dt>
              <dd>{ossReady ? "已读取环境变量" : "缺少 ALI_OSS_ACCESS_KEY_ID / ALI_OSS_ACCESS_KEY_SECRET"}</dd>
            </div>
            <div>
              <dt>管理员</dt>
              <dd>{adminReady ? "已允许访问" : "生产环境需要 ADMIN_USERNAMES 或 ADMIN_USER_IDS"}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>HEALTH</p>
              <h2>系统状态</h2>
            </div>
            <ShieldCheck size={22} aria-hidden />
          </div>
          <ul className={styles.checkList}>
            <li>
              <span className={supabase ? styles.dotOk : styles.dotWarn} />
              Supabase {supabase ? "已连接" : "未配置"}
            </li>
            <li>
              <span className={ossReady ? styles.dotOk : styles.dotWarn} />
              阿里云 OSS {ossReady ? "已连接" : "未配置密钥"}
            </li>
            <li>
              <span className={adminReady ? styles.dotOk : styles.dotWarn} />
              管理员入口 {adminReady ? "可用" : "未设置管理员名单"}
            </li>
          </ul>
        </section>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p>ALBUMS</p>
            <h2>最近作品组</h2>
          </div>
          <Link className="ghost-button" href="/my/photos">
            我的照片
          </Link>
        </div>

        {recentAlbums.length ? (
          <div className={styles.table}>
            {recentAlbums.map((album) => (
              <div className={styles.tableRow} key={album.id}>
                <div>
                  <Link href={`/album/${album.id}`} className={styles.rowTitle}>
                    {album.title || "未命名作品组"}
                  </Link>
                  <p>
                    {album.photoCount} 张照片 · {album.visibility ?? "public"} · {formatDate(album.createdAt)}
                  </p>
                </div>
                <DeleteAlbumButton albumId={album.id} title={album.title || "未命名作品组"} />
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>还没有作品组。</p>
        )}
      </section>

      <section className={styles.grid}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>PHOTOS</p>
              <h2>最近照片</h2>
            </div>
          </div>
          {recentPhotos.length ? (
            <div className={styles.photoList}>
              {recentPhotos.map((photo) => (
                <Link href={`/photos/${photo.id}`} className={styles.photoRow} key={photo.id}>
                  {photo.thumbnailUrl ? <img src={photo.thumbnailUrl} alt="" loading="lazy" /> : <span />}
                  <div>
                    <strong>{photo.title || "未命名照片"}</strong>
                    <p>
                      {photo.mimeType ?? "image"} · {formatBytes(photo.size)} · {formatDate(photo.uploadedAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>还没有照片。</p>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p>USERS</p>
              <h2>用户</h2>
            </div>
          </div>
          {users.length ? (
            <div className={styles.userList}>
              {users.map((user) => (
                <Link href={`/users/${encodeURIComponent(user.id)}`} className={styles.userRow} key={user.id}>
                  {user.avatar_url ? <img src={user.avatar_url} alt="" loading="lazy" /> : <span>{initialOf(user)}</span>}
                  <div>
                    <strong>{user.display_name || user.username || "Film User"}</strong>
                    <p>@{user.username || user.id.slice(0, 8)} · {formatDate(user.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>还没有用户资料。</p>
          )}
        </section>
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className={`${styles.stat} ${tone === "ok" ? styles.statOk : tone === "warn" ? styles.statWarn : ""}`}>
      {icon}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

async function countRows(supabase: SupabaseAdmin, table: string) {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) {
    return 0;
  }

  return count ?? 0;
}

async function readRecentAlbums(supabase: SupabaseAdmin): Promise<RecentAlbum[]> {
  const { data, error } = await supabase
    .from("albums")
    .select("id,title,user_id,visibility,created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    return [];
  }

  return Promise.all(
    data.map(async (item: any) => {
      const { count } = await supabase.from("photos").select("id", { count: "exact", head: true }).eq("album_id", item.id);

      return {
        id: item.id,
        title: item.title,
        ownerId: item.user_id,
        visibility: item.visibility,
        createdAt: item.created_at,
        photoCount: count ?? 0
      };
    })
  );
}

async function readRecentPhotos(supabase: SupabaseAdmin): Promise<RecentPhoto[]> {
  const selectWithOss = "id,title,thumbnail_url,original_url,original_path,file_size,mime_type,uploaded_at,created_at";
  let response: { data: any[] | null; error: { message?: string } | null } = await supabase
    .from("photos")
    .select(selectWithOss)
    .order("created_at", { ascending: false })
    .limit(8);

  if (response.error) {
    response = await supabase.from("photos").select("id,title,original_path,created_at").order("created_at", { ascending: false }).limit(8);
  }

  if (response.error || !response.data) {
    return [];
  }

  return response.data.map((item: any) => ({
    id: item.id,
    title: item.title,
    thumbnailUrl: item.thumbnail_url ?? item.original_url ?? (item.original_path ? publicObjectUrl(item.original_path) : undefined),
    size: item.file_size,
    mimeType: item.mime_type,
    uploadedAt: item.uploaded_at ?? item.created_at
  }));
}

async function readUsers(supabase: SupabaseAdmin): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,created_at")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error || !data) {
    return [];
  }

  return data;
}

function formatDate(value?: string) {
  if (!value) {
    return "未知时间";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未知时间";
  }

  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) {
    return "未知大小";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function initialOf(user: ProfileRow) {
  return (user.display_name || user.username || "F").slice(0, 1).toUpperCase();
}

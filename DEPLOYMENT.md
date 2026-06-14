# Film Archive 部署说明

## GitHub 上传前检查

可以提交到 GitHub：

- `src/`
- `supabase/`
- `package.json`
- `package-lock.json`
- `README.md`
- `.env.example`

不要提交到 GitHub：

- `.env.local`
- `.film-archive-config.json`
- `node_modules/`
- `.next/`
- `uploads/`
- `dev-server*.log`
- `D:\FilmArchive` 里的照片文件

## Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 里配置：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=
ADMIN_USERNAMES=
ADMIN_USER_IDS=
```

`APP_SESSION_SECRET` 必须是随机长字符串。可以在本机生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`ADMIN_USERNAMES` 可以填你的登录用户名，例如：

```text
ADMIN_USERNAMES=sakura
```

## 关于本地硬盘存储

当前项目把照片保存到本机硬盘，例如：

```text
D:\FilmArchive
```

这适合本机、NAS、Mac mini、VPS 这类长期运行的机器。

Vercel 的运行环境不能持久保存上传文件，也不能访问你电脑的 D 盘。因此：

- Vercel 可以部署网站代码、登录页、公开页面和数据库逻辑。
- Vercel 不适合作为当前“本地硬盘上传存储”的最终生产环境。
- 如果要公网稳定上传和浏览照片，需要改成 Cloudflare R2、Supabase Storage，或把 Next.js 应用部署到 NAS/VPS，并把照片盘挂载到服务器。

## 本次安全加固

- 生产环境必须配置 `APP_SESSION_SECRET`，不再使用固定开发密钥。
- 存储管理接口在生产环境只允许管理员访问。
- 普通访客不能通过接口看到服务器本地路径和磁盘容量。
- 备份目录 `backup` 不再通过公开图片接口访问。
- 添加基础安全响应头：`X-Content-Type-Options`、`Referrer-Policy`、`Permissions-Policy`、`X-Frame-Options`。

## 本地验证命令

```bash
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```

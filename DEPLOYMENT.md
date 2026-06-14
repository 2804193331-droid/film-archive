# Film Archive 部署说明

## GitHub 上传前检查

可以提交到 GitHub：

- `src/`
- `supabase/`
- `package.json`
- `package-lock.json`
- `README.md`
- `DEPLOYMENT.md`
- `.env.example`

不要提交到 GitHub：

- `.env.local`
- `.film-archive-config.json`
- `node_modules/`
- `.next/`
- `.vercel/`
- `uploads/`
- `dev-server*.log`
- 本地照片文件

## Vercel 环境变量

在 Vercel Project Settings -> Environment Variables 里添加：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_SESSION_SECRET
ALI_OSS_ACCESS_KEY_ID
ALI_OSS_ACCESS_KEY_SECRET
ALI_OSS_BUCKET
ALI_OSS_REGION
ALI_OSS_ENDPOINT
ALI_OSS_PUBLIC_BASE_URL
ADMIN_USERNAMES
ADMIN_USER_IDS
```

必填：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_SESSION_SECRET
ALI_OSS_ACCESS_KEY_ID
ALI_OSS_ACCESS_KEY_SECRET
```

有默认值但建议显式配置：

```text
ALI_OSS_BUCKET=film-archive-images
ALI_OSS_REGION=cn-shanghai
ALI_OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
```

可选：

```text
ALI_OSS_PUBLIC_BASE_URL
ADMIN_USERNAMES
ADMIN_USER_IDS
```

`APP_SESSION_SECRET` 必须是随机长字符串。可以生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Supabase 数据库迁移

部署前在 Supabase SQL Editor 重新执行：

```text
supabase/schema.sql
```

这会为 `photos` 表补齐：

```text
original_url
preview_url
thumbnail_url
file_size
mime_type
uploaded_at
```

## 阿里云 OSS CORS

Bucket 需要允许浏览器直传：

```text
AllowedOrigin:
  https://你的-vercel-域名
  http://localhost:3000

AllowedMethod:
  PUT
  GET
  HEAD

AllowedHeader:
  *

ExposeHeader:
  ETag
```

## 部署后验证

```bash
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```

线上检查：

- 首页不再跳 `/setup`
- `/api/storage/status` 显示 `provider: aliyun-oss`
- 上传页可以选择最多 100 张照片
- 上传时进度条来自浏览器到 OSS 的 PUT 进度
- Supabase `photos` 表能看到 OSS URL、文件大小、MIME Type、上传时间

## 说明

Vercel 不再接收 100MB 图片文件本体。图片从浏览器直接上传到阿里云 OSS，Vercel 只负责签名和写数据库，因此可以避开云函数请求体限制，也修复了旧本地硬盘配置导致的线上重定向问题。

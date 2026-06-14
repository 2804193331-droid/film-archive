# Film Archive

Film Archive 是一个 Next.js 摄影作品社区与胶片作品档案馆。

当前版本使用：

- Next.js
- Supabase Auth
- Supabase Database
- 阿里云 OSS 图片存储
- 小红书式作品组瀑布流
- 批量上传和 OSS 直传进度条

## 功能

- 公开浏览首页作品组
- 登录后上传照片
- 支持单张、多张、文件夹上传
- 一次最多上传 100 张
- 单张最大 100MB
- 浏览器直传阿里云 OSS
- 上传完成后写入 Supabase
- 首页从 Supabase 读取作品组
- 图片展示使用 OSS URL
- 个人中心与头像修改
- 我的照片、编辑作品组、追加照片、删除作品组
- 深色模式 / 浅色模式 / 跟随系统

## 启动

```bash
npm install
npm run dev
```

打开：

```text
http://localhost:3000
```

## 环境变量

复制 `.env.example` 为 `.env.local`，填写：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_SESSION_SECRET=

ALI_OSS_ACCESS_KEY_ID=
ALI_OSS_ACCESS_KEY_SECRET=
ALI_OSS_BUCKET=film-archive-images
ALI_OSS_REGION=cn-shanghai
ALI_OSS_ENDPOINT=oss-cn-shanghai.aliyuncs.com
ALI_OSS_PUBLIC_BASE_URL=

ADMIN_USERNAMES=
ADMIN_USER_IDS=
```

`ALI_OSS_PUBLIC_BASE_URL` 可留空。留空时默认使用：

```text
https://film-archive-images.oss-cn-shanghai.aliyuncs.com
```

如果以后绑定 CDN 或自定义域名，可以把它填成你的公开图片域名。

## Supabase

在 Supabase SQL Editor 执行：

```text
supabase/schema.sql
supabase/seed.sql
```

`photos` 表会保存：

- OSS object key
- 原图 URL
- 预览 URL
- 缩略图 URL
- 文件大小
- MIME Type
- 上传时间

## 阿里云 OSS

默认配置：

```text
Bucket: film-archive-images
Region: cn-shanghai
Endpoint: oss-cn-shanghai.aliyuncs.com
```

浏览器会先向后端请求签名 URL，然后直接 PUT 文件到 OSS。AccessKey 只存在服务端环境变量中，不会暴露给浏览器。

Bucket 需要配置 CORS，允许浏览器直传：

```text
AllowedOrigin: 你的站点域名，本地开发可加 http://localhost:3000
AllowedMethod: PUT, GET, HEAD
AllowedHeader: *
ExposeHeader: ETag
```

如果图片要直接公开显示，Bucket 或对应对象需要允许公开读取，或者通过 CDN/自定义域名提供公开访问。

## 本地硬盘存储

旧版 `UPLOAD_DIR / D:\FilmArchive` 本地硬盘存储已经不再用于生产上传。

`/setup` 不再配置本地路径，首页也不会因为未配置本地硬盘而跳转。

## 验证

```bash
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
```

# Film Archive

Film Archive 是一个 Next.js 摄影社区雏形，定位为“公开浏览 + 登录上传 + 本地硬盘存储 + 胶片摄影数据库 + 作品档案馆”。

## 已实现

- 首页小红书式瀑布流、懒加载、搜索和筛选
- 照片详情页：大图、上传者、相机、镜头、胶卷、ISO、光圈、快门、焦距、日期、地点、扫描设备、备注
- 系列列表和系列详情
- 登录 / 注册入口，使用 Supabase Auth
- 深色模式 / 浅色模式 / 跟随系统
- 首次启动 `/setup`，自动检测 Windows 盘符、macOS `/Volumes/*`、Linux `/mnt/*`
- 本地硬盘存储目录：`originals`、`previews`、`thumbnails`、`backup`
- 存储管理：当前位置、在线状态、已用空间、剩余空间、图片数量、更换路径
- 上传接口：多文件 / 文件夹、格式校验、120MB 后端限制、EXIF 读取、预览图和缩略图生成
- Supabase SQL：用户资料、照片、系列、胶片、相机、镜头、点赞、收藏和 RLS 权限

## 启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。首次进入会跳转到 `/setup`，选择一个照片存储目录后会自动创建：

```text
originals
previews
thumbnails
backup
```

如果你更喜欢环境变量固定路径，可以复制 `.env.example` 为 `.env.local`，填写：

```text
UPLOAD_DIR=D:\PhotoArchive
```

## Supabase 配置

1. 在 Supabase SQL Editor 中依次执行：
   - `supabase/schema.sql`
   - `supabase/seed.sql`
2. 复制 `.env.example` 为 `.env.local`
3. 填入：

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

上传接口会验证用户登录，并用 `SUPABASE_SERVICE_ROLE_KEY` 将照片记录写入数据库。照片文件仍然只存到本地硬盘，不使用 Supabase Storage。

## 路径策略

数据库只保存相对路径，例如：

```text
originals/2026/06/001.jpg
```

不会保存：

```text
D:\FilmDisk\originals\2026\06\001.jpg
```

因此将硬盘从 `FilmDisk` 换到 `PhotoArchive` 时，只需要在“设置 -> 存储管理”里更换 `UPLOAD_DIR`。

## 只读模式

当外接硬盘或 NAS 不在线时，网站会进入只读模式：

- 仍可浏览数据库中的照片信息
- 禁止上传、删除和修改
- 顶部会提示“照片存储硬盘未连接”

## 后续建议

- 接入真实“我的照片 / 我的系列”管理列表
- 将点赞、收藏按钮接入数据库
- 增加后台任务：批量修复缩略图、重新扫描目录、迁移照片
- 为上传增加更细的逐文件状态和失败文件队列

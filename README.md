# RC Deportivo 微信公众号二级分类模板

面向微信公众号的移动端 H5 页面模板。默认微信模板通常只有单分组，这个项目改成二级分组：

- 标题栏下方：头条大图预览（可轮播，顺序与当前分类文章列表一致）
- 大图下方：赛季（蓝底标签，可左右滑动）
- 左侧：比赛 / 内容类别
- 主区：当前分类全部文章（含头条），右侧都显示缩略小图

后台地址：`#/admin`，可自由添加赛季、类别和文章。修改会保存在浏览器 `localStorage`。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开提示的本地地址。手机预览可用微信开发者工具，或把电脑 IP 配到手机访问。

后台入口：直接打开 `#/admin`。

## 内容怎么配

1. 打开 `#/admin`
2. 添加赛季（例如 `2025/26`），用上移 / 下移调整顶部赛季顺序
3. 给该赛季添加类别（例如 `西乙联赛`、`国王杯`），在同一赛季内上移 / 下移调整左侧分类顺序
4. 添加文章：粘贴微信文章链接，点「读取原文信息」。也可在文章页一键导入：先选目标赛季和分类，填关键字与日期范围。配置 `WECHAT_APPID` / `WECHAT_APPSECRET` 后点「从关联公众号导入」。未配置密钥时，在已登录的公众号后台打开开发者工具 → Network → `appmsgpublish`，把响应 JSON 贴到「从粘贴 JSON 导入」。重复链接会跳过。不要把后台 `token` 或 AppSecret 发给别人。
5. 标题、封面图、发表日期会从原文自动填入，需要时再手动改
6. 勾选「头条」，标题栏下方会按文章列表顺序展示最多 3 张大图预览
7. 在文章列表按住左侧 ⋮⋮ 拖动，调整当前分类在门户和头条轮播里的显示顺序；新文章默认排在最前；顺序填 `-1` 排在最后
8. 需要发布时，在「站点」页导出 JSON，覆盖 `src/data/defaultContent.ts` 后重新构建

封面图可留空，页面会用俱乐部蓝白占位图。文章链接建议填已发布的微信图文 URL。

微信封面图（`mmbiz.qpic.cn`）现在常会拦截外站引用。页面会先用 `no-referrer` 直连；失败后再走本站 `/api/wechat-cover` 代取。GitHub Pages 等纯静态托管没有这个接口，微信封面可能显示为队徽占位图，可改用 Cloudflare Pages / Vercel，或把封面传到自己的图床。

自动读取依赖服务端代抓原文（浏览器直接请求 `mp.weixin.qq.com` 会被 CORS 拦截）。本地 `npm run dev` 已内置 `/api/article-meta`、`/api/wechat-cover` 和 `/api/wechat-publish`。线上请用 Cloudflare Pages（本仓库 `functions/api/`）或 Vercel（`api/`）。纯 GitHub Pages 没有后端，后台无法自动读取原文、代取微信封面，也无法关联公众号一键导入。

## 关联公众号一键导入

1. 在微信公众平台复制 AppID、AppSecret（设置与开发 → 开发接口管理）。
2. 本地复制 `.env.example` 为 `.env`，填入 `WECHAT_APPID`、`WECHAT_APPSECRET`，然后重启 `npm run dev`。
3. Cloudflare Pages / Vercel 把同样的变量配到项目环境变量（不要用 `VITE_` 前缀，密钥不能进前端包）。
4. 公众号后台把本机或托管平台的出口 IP 加入 IP 白名单。
5. 打开 `#/admin` → 文章，选择目标赛季和分类，填关键字（可空）和日期，点「从关联公众号导入」。

接口走微信官方 `freepublish/batchget`（已发布图文）。没有该权限、IP 未加白名单、或密钥无效时，请改用粘贴 JSON。不要用公众号后台页面上的 `token=` 代登。

请粘贴**已发布文章的分享链接**（含 `__biz`、`mid`、`idx`、`sn`，或 `/s/短链`）。从公众号后台复制的地址常带 `&amp;`、`token`、`poc_token`，微信会跳到安全验证页，服务器无法自动通过。遇到「微信要求安全验证」时，在微信里打开文章 → 右上角分享 → 复制链接，或手动填写标题、封面和日期。

## 构建

```bash
npm run build
npm run preview
```

产物在 `dist/`。`vite.config.ts` 使用相对路径 `base: './'`，适合放到任意子目录或对象存储。
门户页面本身是静态站点。若要在后台自动读取微信原文信息，需要带 Functions 的托管（推荐 Cloudflare Pages）。

## 托管到哪里（适合公众号）

这是纯静态站点，不需要后端。公众号菜单 / 自动回复里填 **HTTPS** 链接即可。

推荐：

| 平台 | 适合场景 | 说明 |
| --- | --- | --- |
| Cloudflare Pages | 国内访问相对稳、免费 HTTPS，支持自动读原文 | 连接 Git 仓库，构建命令 `npm run build`，输出目录 `dist`。会部署 `functions/` |
| Vercel | 自动部署最快，支持自动读原文 | Framework 选 Vite，输出 `dist`。会部署 `api/` |
| Netlify | 拖拽 `dist` 即可上线 | 也可 Git 持续部署；自动读原文需另配函数 |
| GitHub Pages | 已有 GitHub 仓库 | 本仓库已带 `.github/workflows/pages.yml`。仓库 Settings → Pages → Source 选 GitHub Actions。**不能**自动读取微信原文 |
| 腾讯云 COS / 阿里云 OSS + CDN | 需要国内备案域名时 | 上传 `dist/`，开 HTTPS 和静态网站 |

微信侧注意：

1. 必须 HTTPS，且证书有效。
2. 公众号后台「设置与开发 → 公众号设置 → 功能设置」配置 JS 接口安全域名（调用 JSSDK 时才必须；普通外链打开页面通常只要 HTTPS）。
3. 微信封面图常禁止外站引用。带 Functions 的托管会代取封面；纯静态站请改用自己的图床。分类门户一般填菜单 URL 即可。
4. 文章跳转到 `mp.weixin.qq.com` 图文，用户仍在微信内阅读。
5. 封面图如果用外链，确保该图床允许微信内访问。

GitHub Pages 示例地址形态：

`https://<user>.github.io/<repo>/#/s/season-2526/c/cat-2526-league`

## src/lib/wechatOfficial.ts`：公众号已发布图文列表（AppID / AppSecret）
- `functions/api/article-meta.ts`：Cloudflare Pages 读取原文
- `functions/api/wechat-cover.ts`：Cloudflare Pages 代取微信封面
- `functions/api/wechat-publish.ts`：Cloudflare Pages 一键导入公众号文章
- `api/article-meta.ts`：Vercel 读取原文
- `api/wechat-cover.ts`：Vercel 代取微信封面
- `api/wechat-publish.ts`：Vercel 一键导入公众号文章 / 文章（可贴链接自动读取），赛季、同赛季类别、同分类文章可排序
- `src/components/SortableList.tsx`：后台文章拖动排序
- `src/lib/articleMeta.ts`：从原文 HTML 解析标题、封面、日期
- `src/components/HeadlineBanner.tsx`：标题栏下方头条大图
- `src/data/defaultContent.ts`：示例内容
- `src/lib/storage.ts`：本地持久化与 JSON 导出
- `src/lib/wechatCover.ts`：微信封面防盗链检测与代取
- `functions/api/article-meta.ts`：Cloudflare Pages 读取原文
- `functions/api/wechat-cover.ts`：Cloudflare Pages 代取微信封面
- `api/article-meta.ts`：Vercel 读取原文
- `api/wechat-cover.ts`：Vercel 代取微信封面

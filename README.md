# Paper Pulse

一个长期运行的每日论文推送网站，默认关注：

- AI 医学影像
- 3D 重建
- 世界模型

## 运行

```bash
npm install
npm run generate
npm start
```

然后打开：

```text
http://localhost:4173
```

## 长期公开运行

这个项目已经配置为 GitHub Pages + GitHub Actions：

- `npm run generate` 会抓取最新论文并生成 `public/data/papers.json`
- `.github/workflows/pages.yml` 会每天 12:20 UTC 自动更新并部署
- 静态站点从 `public/` 发布，不依赖你的电脑长期在线

部署到 GitHub 后，在仓库的 Settings → Pages 里选择 GitHub Actions。随后每次 push、手动运行 workflow、或每日定时任务都会更新网站。

## 数据来源

服务端通过 arXiv API 拉取 Atom 结果，按提交时间倒序获取每个方向的最新论文，并缓存当天结果。点击页面右上角刷新会强制重新抓取。

## 公开访问

开发时可以用本机公网隧道临时分享：

```bash
npx localtunnel --port 4173
```

长期公开部署可以使用 Render：

1. 把 `outputs/paper-pulse` 推到一个 GitHub 仓库。
2. 在 Render 新建 Blueprint 或 Web Service。
3. 使用本目录里的 `render.yaml`，或手动设置：
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

## 后续可扩展

- 增加 Semantic Scholar / PubMed 数据源
- 加入邮件、飞书或 Telegram 定时推送
- 增加基于阅读行为的个性化排序
- 增加中文摘要和每日综述

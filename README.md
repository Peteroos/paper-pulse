# Paper Pulse

一个长期运行的每日论文推送网站，默认关注：

- AI 医学影像
- 3D 重建
- 世界模型

公开网址部署成功后会在这里：

```text
https://peteroos.github.io/paper-pulse/
```

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
- 如果仓库 Secret 里配置了 `OPENAI_API_KEY`，生成脚本会只为新论文补充 AI 中文总结，并复用旧缓存来省钱
- 默认每次 workflow 最多总结 12 篇新论文，避免首次构建过久；可用 Actions variable `AI_SUMMARY_LIMIT` 调整

部署到 GitHub 后，在仓库的 Settings → Pages 里选择 GitHub Actions。随后每次 push、手动运行 workflow、或每日定时任务都会更新网站。

## OpenAI API Key

在 GitHub 仓库里添加 Secret：

1. 打开 Settings → Secrets and variables → Actions。
2. 在 Secrets 里点击 New repository secret。
3. Name 填 `OPENAI_API_KEY`。
4. Secret 填你的 OpenAI API key。
5. 保存后手动运行一次 `Update Papers and Deploy Pages` workflow。

这个 key 不会进入前端代码，也不会写入 `public/data/papers.json`。GitHub Actions 只在服务器端运行生成脚本时读取它，网站用户只能看到生成好的 AI 总结。

如果首次运行太慢，可以在 Variables 里添加：

- `AI_SUMMARY_LIMIT=6` 更省钱更快
- `AI_SUMMARY_LIMIT=20` 更快补齐缓存，但构建更久

## 数据来源

服务端通过 arXiv API 拉取 Atom 结果，按提交时间倒序获取每个方向的最新论文，并缓存当天结果。页面优先读取 `public/data/papers.json`，本地开发时也可以通过 `/api/papers` 实时刷新。

## 后续可扩展

- 增加 Semantic Scholar / PubMed 数据源
- 加入邮件、飞书或 Telegram 定时推送
- 增加基于阅读行为的个性化排序
- 增加中文摘要和每日综述

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
- GitHub Pages 版本只抓取和展示论文数据，不会在 build 时调用 OpenAI；实时 AI 总结需要一个后端 API，推荐部署到 Vercel

部署到 GitHub 后，在仓库的 Settings → Pages 里选择 GitHub Actions。随后每次 push、手动运行 workflow、或每日定时任务都会更新网站。

## 实时 AI 总结

为了避免批量烧 token，AI 总结改成用户点击后才生成：

- 前端显示“生成 AI 总结”按钮
- 用户点击后请求自己的 `/api/summarize`
- OpenAI key 只放在后端环境变量里
- 总结结果会缓存在用户浏览器，避免同一用户重复请求同一篇

### Vercel 部署

1. 在 Vercel 导入 `Peteroos/paper-pulse`。
2. Environment Variables 里添加：
   - `OPENAI_API_KEY`: 你的 OpenAI API key
   - `OPENAI_MODEL`: `gpt-5-nano`
3. 部署后访问 Vercel 网址，实时总结按钮即可使用。

如果继续使用 GitHub Pages，又想调用另一个 Vercel API，在 `public/config.js` 里把 `PAPER_PULSE_API_BASE` 指向 Vercel 域名。

key 不会进入前端代码，也不会写入 `public/data/papers.json`。用户只能看到生成好的 AI 总结，看不到 `OPENAI_API_KEY`。

## 数据来源

服务端通过 arXiv API 拉取 Atom 结果，按提交时间倒序获取每个方向的最新论文，并缓存当天结果。页面优先读取 `public/data/papers.json`，本地开发时也可以通过 `/api/papers` 实时刷新。

## 后续可扩展

- 增加 Semantic Scholar / PubMed 数据源
- 加入邮件、飞书或 Telegram 定时推送
- 增加基于阅读行为的个性化排序
- 增加中文摘要和每日综述

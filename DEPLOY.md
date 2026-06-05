# Deploy Paper Pulse

## 1. Create the GitHub repository

Create a new public repository under `Peteroos` named:

```text
paper-pulse
```

Do not initialize it with a README, license, or `.gitignore`.

## 2. Push this project

From this directory:

```bash
git remote set-url origin https://github.com/Peteroos/paper-pulse.git
git push -u origin main
```

If Git asks for authentication, use a GitHub personal access token or sign in with GitHub Desktop.

## 3. Enable GitHub Pages

In the repository:

1. Open Settings → Pages.
2. Set Source to GitHub Actions.
3. Open Actions and run `Update Papers and Deploy Pages` once.

After it succeeds, the site will be available at:

```text
https://peteroos.github.io/paper-pulse/
```

The workflow also runs every day at 12:20 UTC to refresh paper data.

## Optional on-demand AI summaries and email subscriptions

GitHub Pages is static and cannot securely call OpenAI, save emails, or send scheduled mail by itself. For real-time AI summaries and email subscriptions, deploy this project to Vercel or another host that supports serverless functions and cron jobs.

Vercel setup:

1. Import `Peteroos/paper-pulse` into Vercel.
2. Set Framework Preset to `Other`, not `Express`.
3. Set Build Command to `npm run generate`.
4. Leave Output Directory blank/default.
5. Add Environment Variable `OPENAI_API_KEY`.
6. Optionally add `OPENAI_MODEL=gpt-5-nano`.
7. Create or connect Vercel Blob, then make sure `BLOB_READ_WRITE_TOKEN` is available.
8. Add `RESEND_API_KEY` from Resend.
9. Add `RESEND_FROM`, using a verified sender such as `Paper Pulse <papers@yourdomain.com>`.
10. Deploy.

The browser calls `/api/summarize` and `/api/subscribe`; API keys and email service keys stay in the serverless environment and are never bundled into the static website.

Vercel Cron is configured in `vercel.json` to call `/api/send-digest` at `12:30 UTC` every day. Leave `CRON_SECRET` unset at first; if you add it later, the cron request must include `Authorization: Bearer <CRON_SECRET>`.

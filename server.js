import express from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDigestEmail, sendDigestEmail } from "./src/email-digest.js";
import { summarizePaper } from "./src/ai-summary.js";
import { fetchDailyPapers, topics } from "./src/papers.js";
import { validateSummaryRequest } from "./src/request-validation.js";
import { readSubscriptions, writeSubscriptions } from "./src/subscription-store.js";
import { upsertSubscription, validateSubscriptionRequest } from "./src/subscriptions.js";

const app = express();
const PORT = Number(process.env.PORT || 4173);
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

let cache = {
  fetchedAt: 0,
  papers: [],
  topics,
  error: null,
};

app.use(express.static("public"));
app.use(express.json({ limit: "80kb" }));

app.get("/api/topics", (_req, res) => {
  res.json({ topics });
});

app.get("/api/papers", async (req, res) => {
  const force = req.query.refresh === "1";
  const now = Date.now();

  if (!force && cache.papers.length && now - cache.fetchedAt < CACHE_TTL_MS) {
    res.json({ ...cache, cached: true });
    return;
  }

  try {
    cache = await fetchDailyPapers();
    res.json({ ...cache, cached: false });
  } catch (error) {
    cache = {
      ...cache,
      error: error instanceof Error ? error.message : "Unknown fetch error",
    };
    res.status(cache.papers.length ? 200 : 502).json({
      ...cache,
      cached: Boolean(cache.fetchedAt),
    });
  }
});

app.post("/api/summarize", async (req, res) => {
  const validation = validateSummaryRequest(req.body);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const summary = await summarizePaper(validation.paper);
    res.json({ aiSummary: summary });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to summarize paper",
    });
  }
});

app.post("/api/subscribe", async (req, res) => {
  const validation = validateSubscriptionRequest(req.body, topics);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const subscriptions = await readSubscriptions();
    await writeSubscriptions(upsertSubscription(subscriptions, validation.subscription));
    res.json({ ok: true, message: "订阅已保存", topicIds: validation.subscription.topicIds });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save subscription",
    });
  }
});

app.get("/api/send-digest", async (req, res) => {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [subscriptions, payload] = await Promise.all([
      readSubscriptions(),
      readPaperPayload(),
    ]);

    for (const subscription of subscriptions) {
      const digest = buildDigestEmail(subscription, payload);
      await sendDigestEmail({ to: subscription.email, subject: digest.subject, html: digest.html });
    }

    res.json({ ok: true, sent: subscriptions.length });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send digest",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Paper Pulse is running at http://localhost:${PORT}`);
});

async function readPaperPayload() {
  return JSON.parse(await readFile(resolve(process.cwd(), "public/data/papers.json"), "utf8"));
}

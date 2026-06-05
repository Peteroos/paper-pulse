import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildDigestEmail, sendDigestEmail } from "../src/email-digest.js";
import { readSubscriptions } from "../src/subscription-store.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }

  try {
    const [subscriptions, payload] = await Promise.all([readSubscriptions(), readPaperPayload()]);
    const results = [];

    for (const subscription of subscriptions) {
      const digest = buildDigestEmail(subscription, payload);
      const result = await sendDigestEmail({
        to: subscription.email,
        subject: digest.subject,
        html: digest.html,
      });
      results.push({ email: subscription.email, result });
    }

    res.status(200).json({
      ok: true,
      sent: results.length,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send digest",
    });
  }
}

async function readPaperPayload() {
  const dataPath = resolve(process.cwd(), "public/data/papers.json");
  return JSON.parse(await readFile(dataPath, "utf8"));
}

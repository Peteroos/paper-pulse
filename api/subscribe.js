import { topics } from "../src/papers.js";
import { readSubscriptions, writeSubscriptions } from "../src/subscription-store.js";
import { upsertSubscription, validateSubscriptionRequest } from "../src/subscriptions.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const validation = validateSubscriptionRequest(req.body, topics);
  if (!validation.ok) {
    res.status(validation.status).json({ error: validation.error });
    return;
  }

  try {
    const subscriptions = await readSubscriptions();
    const nextSubscriptions = upsertSubscription(subscriptions, validation.subscription);
    await writeSubscriptions(nextSubscriptions);
    res.status(200).json({
      ok: true,
      message: "订阅已保存",
      topicIds: validation.subscription.topicIds,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save subscription",
    });
  }
}

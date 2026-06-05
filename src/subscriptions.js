const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSubscriptionRequest(body = {}, topics = []) {
  const email = normalizeEmail(body.email);
  const allowedTopicIds = new Set(topics.map((topic) => topic.id));
  const topicIds = Array.isArray(body.topicIds)
    ? body.topicIds.map((id) => String(id || "").trim()).filter((id) => allowedTopicIds.has(id))
    : [];

  if (!EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: "请输入有效邮箱" };
  }

  if (!topicIds.length) {
    return { ok: false, status: 400, error: "请至少选择一个方向" };
  }

  return {
    ok: true,
    subscription: {
      email,
      topicIds: [...new Set(topicIds)],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function upsertSubscription(subscriptions, nextSubscription) {
  const existing = subscriptions.find((item) => item.email === nextSubscription.email);
  const others = subscriptions.filter((item) => item.email !== nextSubscription.email);

  if (!existing) {
    return [...others, nextSubscription].sort(sortByEmail);
  }

  return [
    ...others,
    {
      ...existing,
      topicIds: nextSubscription.topicIds,
      updatedAt: nextSubscription.updatedAt,
    },
  ].sort(sortByEmail);
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sortByEmail(a, b) {
  return a.email.localeCompare(b.email);
}

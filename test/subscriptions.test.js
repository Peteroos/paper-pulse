import assert from "node:assert/strict";
import test from "node:test";
import { topics } from "../src/papers.js";
import { upsertSubscription, validateSubscriptionRequest } from "../src/subscriptions.js";

test("subscription validation requires a valid email", () => {
  const result = validateSubscriptionRequest({ email: "bad", topicIds: ["medical-imaging"] }, topics);

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("subscription validation keeps only allowed topic ids", () => {
  const result = validateSubscriptionRequest(
    {
      email: "USER@example.COM ",
      topicIds: ["medical-imaging", "unknown", "world-models"],
    },
    topics,
  );

  assert.equal(result.ok, true);
  assert.equal(result.subscription.email, "user@example.com");
  assert.deepEqual(result.subscription.topicIds, ["medical-imaging", "world-models"]);
});

test("upsertSubscription updates existing email preferences", () => {
  const next = upsertSubscription(
    [{ email: "user@example.com", topicIds: ["medical-imaging"], createdAt: "old", updatedAt: "old" }],
    { email: "user@example.com", topicIds: ["world-models"], createdAt: "new", updatedAt: "new" },
  );

  assert.equal(next.length, 1);
  assert.deepEqual(next[0].topicIds, ["world-models"]);
  assert.equal(next[0].createdAt, "old");
  assert.equal(next[0].updatedAt, "new");
});

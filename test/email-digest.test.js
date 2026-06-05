import assert from "node:assert/strict";
import test from "node:test";
import { buildDigestEmail } from "../src/email-digest.js";

test("digest email includes only subscribed topics", () => {
  const email = buildDigestEmail(
    { email: "user@example.com", topicIds: ["world-models"] },
    {
      topics: [
        { id: "medical-imaging", name: "AI 医学影像", shortName: "医学影像", color: "#cf3f58" },
        { id: "world-models", name: "世界模型", shortName: "世界模型", color: "#6a58c8" },
      ],
      papers: [
        { topicId: "medical-imaging", title: "Medical", summary: "Medical", abstractUrl: "https://a", hotScore: 99 },
        { topicId: "world-models", title: "World", summary: "World", abstractUrl: "https://b", hotScore: 88 },
      ],
    },
  );

  assert.match(email.subject, /世界模型/);
  assert.match(email.html, /World/);
  assert.doesNotMatch(email.html, /Medical/);
});

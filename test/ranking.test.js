import assert from "node:assert/strict";
import test from "node:test";
import { filterPapersByView, getTopicLeaderboard } from "../src/ranking.js";
import { topics } from "../src/papers.js";

const now = new Date("2026-06-05T12:00:00Z").getTime();

const papers = [
  {
    id: "a",
    topicId: "medical-imaging",
    title: "Fresh strong segmentation paper",
    summary: "medical image segmentation foundation model benchmark",
    published: "2026-06-04T12:00:00Z",
    score: 3,
  },
  {
    id: "b",
    topicId: "medical-imaging",
    title: "Older monthly radiology paper",
    summary: "radiology CT clinical dataset",
    published: "2026-05-18T12:00:00Z",
    score: 20,
  },
  {
    id: "c",
    topicId: "world-models",
    title: "World model planning",
    summary: "video generation embodied AI planning",
    published: "2026-06-02T12:00:00Z",
    score: 5,
  },
  {
    id: "d",
    topicId: "continual-learning",
    title: "Continual learning without catastrophic forgetting",
    summary: "lifelong learning and incremental learning benchmark",
    published: "2026-06-03T12:00:00Z",
    score: 4,
  },
  {
    id: "e",
    topicId: "speculative-decoding",
    title: "Speculative decoding with a draft model",
    summary: "LLM inference acceleration through speculative sampling",
    published: "2026-06-03T12:00:00Z",
    score: 4,
  },
];

test("weekly popular view keeps only papers from the last seven days and sorts by hot score", () => {
  const result = filterPapersByView(papers, {
    viewMode: "week",
    activeTopic: "all",
    now,
  });

  assert.deepEqual(new Set(result.map((paper) => paper.id)), new Set(["a", "c", "d", "e"]));
  assert.ok(result[0].hotScore > result[1].hotScore);
});

test("monthly popular view includes older monthly papers and keeps topic filters", () => {
  const result = filterPapersByView(papers, {
    viewMode: "month",
    activeTopic: "medical-imaging",
    now,
  });

  assert.deepEqual(
    result.map((paper) => paper.id),
    ["a", "b"],
  );
});

test("topic leaderboard returns top papers for each field", () => {
  const leaderboard = getTopicLeaderboard(papers, { viewMode: "month", now, limit: 1 });

  assert.equal(leaderboard["medical-imaging"][0].id, "a");
  assert.equal(leaderboard["world-models"][0].id, "c");
  assert.equal(leaderboard["continual-learning"][0].id, "d");
  assert.equal(leaderboard["speculative-decoding"][0].id, "e");
});

test("configured topics include continual learning and speculative decoding", () => {
  const ids = topics.map((topic) => topic.id);

  assert.ok(ids.includes("continual-learning"));
  assert.ok(ids.includes("speculative-decoding"));
});

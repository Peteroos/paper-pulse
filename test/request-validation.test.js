import assert from "node:assert/strict";
import test from "node:test";
import { validateSummaryRequest } from "../src/request-validation.js";

test("summary request validation requires a paper payload", () => {
  const result = validateSummaryRequest({});

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test("summary request validation keeps only the safe paper fields", () => {
  const result = validateSummaryRequest({
    paper: {
      arxivId: "2606.1",
      title: "  A paper  ",
      summary: "  An abstract  ",
      authors: ["Alice", "Bob"],
      categories: ["cs.CV"],
      topicName: "AI 医学影像",
      secret: "should not pass through",
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.paper).sort(), [
    "arxivId",
    "authors",
    "categories",
    "summary",
    "title",
    "topicName",
  ]);
  assert.equal(result.paper.title, "A paper");
});
